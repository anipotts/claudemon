import { DurableObject } from "cloudflare:workers";
import type { MonitorEvent, SessionState, WsMessage } from "../../../packages/types/monitor";
import { TOOL_CATEGORIES } from "../../../packages/types/monitor";

const MAX_EVENTS = 200;

/** SessionState minus the heavy arrays — what we persist to DO storage. */
type SessionMetadata = Omit<SessionState, "events" | "subagents" | "files_touched" | "commands_run">;

function toMetadata(s: SessionState): SessionMetadata {
  const { events, subagents, files_touched, commands_run, ...meta } = s;
  return meta;
}

function toSessionState(meta: SessionMetadata): SessionState {
  return { ...meta, events: [], subagents: [], files_touched: [], commands_run: [] };
}

export class SessionRoom extends DurableObject {
  // Sessions stored in memory — rebuilt from storage metadata on wake.
  private sessions: Map<string, SessionState> = new Map();
  private loaded = false;

  private async ensureLoaded() {
    if (this.loaded) return;
    this.loaded = true;
    // Restore sessions from per-session DO storage keys
    const entries = await this.ctx.storage.list<SessionMetadata>({ prefix: "session:" });
    for (const [_key, meta] of entries) {
      this.sessions.set(meta.session_id, toSessionState(meta));
    }
  }

  private async persist(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    await this.ctx.storage.put(`session:${sessionId}`, toMetadata(session));
  }

  async fetch(request: Request): Promise<Response> {
    await this.ensureLoaded();
    const url = new URL(request.url);

    if (url.pathname === "/ws") {
      return this.handleWebSocket();
    }

    if (url.pathname === "/event" && request.method === "POST") {
      const event = (await request.json()) as MonitorEvent;
      await this.processEvent(event);
      await this.persist(event.session_id);
      return new Response("ok", { status: 200 });
    }

    if (url.pathname === "/sessions" && request.method === "GET") {
      return Response.json({ sessions: Array.from(this.sessions.values()) });
    }

    if (url.pathname === "/sessions/purge" && request.method === "POST") {
      this.sessions.clear();
      await this.ctx.storage.deleteAll();
      this.broadcast({ type: "sessions_snapshot", sessions: [] });
      return Response.json({ ok: true, purged: true });
    }

    if (url.pathname.startsWith("/sessions/") && request.method === "DELETE") {
      const sessionId = url.pathname.split("/sessions/")[1];
      this.sessions.delete(sessionId);
      await this.ctx.storage.delete(`session:${sessionId}`);
      this.broadcast({
        type: "sessions_snapshot",
        sessions: Array.from(this.sessions.values()).map((s) => toSessionState(toMetadata(s))),
      });
      return Response.json({ ok: true });
    }

    return new Response("not found", { status: 404 });
  }

  private handleWebSocket(): Response {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];

    // Use Hibernation API — survives DO sleep
    this.ctx.acceptWebSocket(server);

    // Send current state snapshot immediately — metadata only, no events
    const snapshot: WsMessage = {
      type: "sessions_snapshot",
      sessions: Array.from(this.sessions.values()).map(toMetadata) as SessionState[],
    };
    server.send(JSON.stringify(snapshot));

    return new Response(null, { status: 101, webSocket: client });
  }

  // Hibernation API callbacks — DO wakes to handle these
  async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    try {
      const data = JSON.parse(typeof msg === "string" ? msg : new TextDecoder().decode(msg));
      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
      }
      if (data.type === "replay" && typeof data.last_event_at === "number") {
        await this.ensureLoaded();
        for (const session of this.sessions.values()) {
          for (const event of session.events) {
            if (event.timestamp > data.last_event_at) {
              ws.send(JSON.stringify({ type: "event", event }));
            }
          }
        }
      }
    } catch {
      // ignore malformed messages
    }
  }

  async webSocketClose(_ws: WebSocket, _code: number, _reason: string, _wasClean: boolean) {
    // Cleanup handled automatically by getWebSockets()
  }

  async webSocketError(_ws: WebSocket, _error: unknown) {
    // Cleanup handled automatically by getWebSockets()
  }

  private async processEvent(event: MonitorEvent) {
    const { session_id } = event;

    // Skip events without a valid session_id (prevents unknown-* ghosts)
    if (!session_id || session_id.startsWith("unknown")) return;

    // Auto-cleanup: remove sessions idle for 10+ minutes
    const now = Date.now();
    for (const [_id, s] of this.sessions) {
      if (now - s.last_event_at > 600000 && s.status !== "done" && s.status !== "offline") {
        s.status = "offline";
      }
    }

    let session = this.sessions.get(session_id);
    if (!session) {
      session = {
        session_id,
        machine_id: event.machine_id,
        project_name: event.project_path.split("/").pop() || "unknown",
        project_path: event.project_path,
        branch: event.branch,
        model: event.model,
        permission_mode: event.permission_mode,
        transcript_path: event.transcript_path,
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
        error_count: 0,
        compaction_count: 0,
        permission_denied_count: 0,
        files_touched: [],
        commands_run: [],
        source: "local",
      };
      this.sessions.set(session_id, session);
    }

    session.last_event_at = event.timestamp;
    if (event.model) session.model = event.model;
    if (event.permission_mode) session.permission_mode = event.permission_mode;
    if (event.cwd) session.cwd = event.cwd;
    if (event.transcript_path) session.transcript_path = event.transcript_path;
    if (event.branch) session.branch = event.branch;

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
        session.error_count = 0;
        session.compaction_count = 0;
        session.permission_denied_count = 0;
        session.files_touched = [];
        session.commands_run = [];
        session.tool_rate = undefined;
        session.error_rate = undefined;
        session.notification_message = undefined;
        session.end_reason = undefined;
        session.compact_summary = undefined;
        session.events = [];
        session.started_at = event.timestamp;
        // Fields only available on SessionStart — previously never received
        // because HTTP hooks were silently blocked by Claude Code for this event.
        // Now captured via async command hooks (v0.6.0+).
        if (event.source) session.session_source = event.source as any;
        if (event.model) session.model = event.model;
        if (event.permission_mode) session.permission_mode = event.permission_mode;
        if (event.transcript_path) session.transcript_path = event.transcript_path;
        if (event.agent_type) session.agent_type = event.agent_type;
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
            edit_count: 0,
            command_count: 0,
            read_count: 0,
            search_count: 0,
            error_count: 0,
            compaction_count: 0,
            permission_denied_count: 0,
            files_touched: [],
            commands_run: [],
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
      case "PreCompact":
        session.status = "working";
        break;
      case "PostCompact":
        session.status = "thinking";
        session.compaction_count++;
        if (event.compact_summary) {
          session.compact_summary = event.compact_summary;
        }
        break;
      case "UserPromptSubmit":
        session.status = "working";
        break;
      case "PermissionRequest":
        session.status = "waiting";
        break;
      case "PermissionDenied":
        session.permission_denied_count++;
        break;
      case "TaskCreated":
      case "TaskCompleted":
      case "TeammateIdle":
        break;
      case "CwdChanged":
        if (event.new_cwd) {
          session.cwd = event.new_cwd;
        }
        break;
      case "FileChanged":
        if (event.file_path) {
          const fp = event.file_path;
          if (!session.files_touched.includes(fp)) {
            session.files_touched.push(fp);
          }
        }
        break;
      case "ConfigChange":
      case "WorktreeCreate":
      case "WorktreeRemove":
      case "InstructionsLoaded":
      case "Elicitation":
      case "ElicitationResult":
      case "Setup":
        break;
    }

    // Notification fields
    if (event.hook_event_name === "Notification") {
      if (event.notification_message) session.notification_message = event.notification_message;
    }

    // End reason
    if (event.hook_event_name === "SessionEnd") {
      if (event.end_reason) session.end_reason = event.end_reason;
    }

    // Track files touched from Edit/Write tool_input
    if (event.tool_name && (event.tool_name === "Edit" || event.tool_name === "Write") && event.tool_input?.file_path) {
      const fp = event.tool_input.file_path as string;
      if (!session.files_touched.includes(fp)) {
        session.files_touched.push(fp);
      }
    }

    // Track bash commands
    if (event.tool_name === "Bash" && event.tool_input?.command) {
      session.commands_run.push((event.tool_input.command as string).slice(0, 100));
      if (session.commands_run.length > 20) session.commands_run = session.commands_run.slice(-20);
    }

    // Error tracking
    if (event.hook_event_name === "PostToolUseFailure") {
      session.error_count++;
    }

    // Compute derived rates
    const elapsed = (event.timestamp - session.started_at) / 60000;
    if (elapsed > 0) {
      const totalTools = session.edit_count + session.command_count + session.read_count + session.search_count;
      session.tool_rate = Math.round((totalTools / elapsed) * 10) / 10;
      session.error_rate = totalTools > 0 ? Math.round((session.error_count / totalTools) * 100) / 100 : 0;
    }

    // Deduplicate Pre/Post via tool_use_id — merge PostToolUse response into PreToolUse
    if (event.hook_event_name === "PostToolUse" && event.tool_use_id) {
      const idx = session.events.findIndex(
        (e) => e.tool_use_id === event.tool_use_id && e.hook_event_name === "PreToolUse",
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

    // Reset 1hr auto-purge alarm on every event
    await this.ctx.storage.setAlarm(Date.now() + 3600_000);

    // Broadcast to ALL connected WebSockets using Hibernation API
    // This survives DO sleep — getWebSockets() returns live connections
    this.broadcast({ type: "event", event });
  }

  // Auto-purge: clear all sessions after 1hr of inactivity
  async alarm() {
    this.sessions.clear();
    await this.ctx.storage.deleteAll();
    this.broadcast({ type: "sessions_snapshot", sessions: [] });
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
