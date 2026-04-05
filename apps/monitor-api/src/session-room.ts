import { DurableObject } from "cloudflare:workers";
import type { MonitorEvent, SessionState, WsMessage } from "../../../packages/types/monitor";
import { TOOL_CATEGORIES } from "../../../packages/types/monitor";

const MAX_EVENTS = 200;

export class SessionRoom extends DurableObject {
  // Sessions stored in memory — rebuilt from events on wake.
  // For persistence across hibernation, we store sessions in DO storage.
  private sessions: Map<string, SessionState> = new Map();
  private loaded = false;

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    // Restore sessions from DO storage
    const stored = await this.ctx.storage.get<Record<string, SessionState>>("sessions");
    if (stored) {
      for (const [k, v] of Object.entries(stored)) {
        this.sessions.set(k, v);
      }
    }
  }

  private async persist() {
    const obj: Record<string, SessionState> = {};
    for (const [k, v] of this.sessions) {
      obj[k] = v;
    }
    await this.ctx.storage.put("sessions", obj);
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureLoaded();
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      return this.handleWebSocket();
    }

    if (url.pathname === "/event" && request.method === "POST") {
      const event = (await request.json()) as MonitorEvent;
      this.processEvent(event);
      await this.persist();
      return new Response("ok", { status: 200 });
    }

    if (url.pathname === "/sessions" && request.method === "GET") {
      return Response.json({ sessions: Array.from(this.sessions.values()) });
    }

    if (url.pathname === "/sessions/purge" && request.method === "POST") {
      this.sessions.clear();
      await this.persist();
      this.broadcast({ type: "sessions_snapshot", sessions: [] });
      return Response.json({ ok: true, purged: true });
    }

    if (url.pathname.startsWith("/sessions/") && request.method === "DELETE") {
      const sessionId = url.pathname.split("/sessions/")[1];
      this.sessions.delete(sessionId);
      await this.persist();
      this.broadcast({ type: "sessions_snapshot", sessions: Array.from(this.sessions.values()) });
      return Response.json({ ok: true });
    }

    return new Response("not found", { status: 404 });
  }

  private handleWebSocket(): Response {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    // Use Hibernation API — survives DO sleep
    this.ctx.acceptWebSocket(server);

    // Send current state snapshot immediately
    const snapshot: WsMessage = {
      type: "sessions_snapshot",
      sessions: Array.from(this.sessions.values()),
    };
    server.send(JSON.stringify(snapshot));

    return new Response(null, { status: 101, webSocket: client });
  }

  // Hibernation API callbacks — DO wakes to handle these
  async webSocketMessage(_ws: WebSocket, _msg: string | ArrayBuffer) {
    // Client-to-server messages (not used yet)
  }

  async webSocketClose(_ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    // Cleanup handled automatically by getWebSockets()
  }

  async webSocketError(_ws: WebSocket, _error: unknown) {
    // Cleanup handled automatically by getWebSockets()
  }

  private processEvent(event: MonitorEvent) {
    const { session_id } = event;

    // Skip events without a valid session_id (prevents unknown-* ghosts)
    if (!session_id || session_id.startsWith("unknown")) return;

    // Auto-cleanup: remove sessions idle for 10+ minutes
    const now = Date.now();
    for (const [id, s] of this.sessions) {
      if (now - s.last_event_at > 600000 && s.status !== "done" && s.status !== "offline") {
        s.status = "offline";
      }
    }

    let session = this.sessions.get(session_id);
    if (!session) {
      const extra = event as Record<string, unknown>;
      session = {
        session_id,
        machine_id: event.machine_id,
        project_name: event.project_path.split("/").pop() || "unknown",
        project_path: event.project_path,
        branch: extra.branch as string | undefined,
        model: event.model,
        permission_mode: event.permission_mode,
        transcript_path: extra.transcript_path as string | undefined,
        cwd: event.cwd,
        status: "thinking",
        started_at: event.timestamp,
        last_event_at: event.timestamp,
        edit_count: 0,
        command_count: 0,
        read_count: 0,
        search_count: 0,
        events: [],
        subagents: [],
        source: "local",
      };
      this.sessions.set(session_id, session);
    }

    const extra = event as Record<string, unknown>;
    session.last_event_at = event.timestamp;
    if (event.model) session.model = event.model;
    if (event.permission_mode) session.permission_mode = event.permission_mode;
    if (event.cwd) session.cwd = event.cwd;
    if (extra.transcript_path) session.transcript_path = extra.transcript_path as string;
    if (extra.branch) session.branch = extra.branch as string;

    switch (event.hook_event_name) {
      case "PreToolUse":
        session.status = "working";
        break;
      case "PostToolUse":
      case "PostToolUseFailure":
        session.status = "thinking";
        if (event.tool_name) {
          if (TOOL_CATEGORIES.edits.has(event.tool_name)) session.edit_count++;
          if (TOOL_CATEGORIES.commands.has(event.tool_name)) session.command_count++;
          if (TOOL_CATEGORIES.reads.has(event.tool_name)) session.read_count++;
          if (TOOL_CATEGORIES.searches.has(event.tool_name)) session.search_count++;
        }
        break;
      case "Notification":
        session.status = "waiting";
        break;
      case "Stop":
        session.status = "done";
        break;
      case "StopFailure":
        session.status = "error";
        break;
      case "SessionEnd":
        session.status = "offline";
        break;
      case "SessionStart":
        session.status = "thinking";
        session.edit_count = 0;
        session.command_count = 0;
        session.read_count = 0;
        session.search_count = 0;
        session.events = [];
        session.started_at = event.timestamp;
        break;
      case "SubagentStart":
        if (event.agent_id) {
          session.subagents.push({
            session_id: event.agent_id,
            machine_id: session.machine_id,
            project_name: session.project_name,
            project_path: session.project_path,
            branch: session.branch,
            status: "working",
            started_at: event.timestamp,
            last_event_at: event.timestamp,
            edit_count: 0, command_count: 0, read_count: 0, search_count: 0,
            events: [],
            parent_session_id: session_id,
            agent_type: event.agent_type,
            subagents: [],
            source: session.source,
          });
        }
        break;
      case "SubagentStop":
        if (event.agent_id) {
          const sub = session.subagents.find((s) => s.session_id === event.agent_id);
          if (sub) sub.status = "done";
        }
        break;
    }

    // Deduplicate Pre/Post via tool_use_id — merge PostToolUse response into PreToolUse
    const toolUseId = (event as Record<string, unknown>).tool_use_id as string | undefined;
    if (event.hook_event_name === "PostToolUse" && toolUseId) {
      const idx = session.events.findIndex(
        (e) => (e as Record<string, unknown>).tool_use_id === toolUseId && e.hook_event_name === "PreToolUse"
      );
      if (idx >= 0) {
        session.events[idx].tool_response = event.tool_response;
        session.events[idx].hook_event_name = "PostToolUse";
        this.broadcast({ type: "event", event });
        return;
      }
    }

    // Ring buffer
    session.events.push(event);
    if (session.events.length > MAX_EVENTS) {
      session.events = session.events.slice(-MAX_EVENTS);
    }

    // Broadcast to ALL connected WebSockets using Hibernation API
    // This survives DO sleep — getWebSockets() returns live connections
    this.broadcast({ type: "event", event });
  }

  private broadcast(msg: WsMessage) {
    const data = JSON.stringify(msg);
    // Use the Hibernation API to get all connected WebSockets
    // This works even after the DO wakes from hibernation
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        // Dead socket — will be cleaned up by the runtime
      }
    }
  }
}
