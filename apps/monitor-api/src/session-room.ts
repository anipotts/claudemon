import { DurableObject } from "cloudflare:workers";
import type { MonitorEvent, WsMessage } from "../../../packages/types/monitor";

/**
 * SessionRoom — Zero-storage WebSocket relay + action bridge.
 *
 * All state derivation and persistence lives in the browser (IndexedDB).
 * The DO is a real-time relay: receive events, broadcast to browsers, discard.
 * Also coordinates the action bridge: sync hooks connect via /ws/action,
 * browsers respond with approve/deny decisions.
 */

interface PendingAction {
  id: string;
  session_id: string;
  hook_event_name: string;
  event_data: Record<string, unknown>;
  created_at: number;
  hookWs: WebSocket | null; // The sync hook's WebSocket
}

const IDLE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export class SessionRoom extends DurableObject {
  // Pending actions awaiting browser response (in-memory, not persisted)
  private pendingActions: Map<string, PendingAction> = new Map();
  // Track which WebSockets are "browser" clients vs "action hook" clients
  // Action hooks attach "action:" tag; browsers have no tag or "browser:" tag
  private actionHookSockets: Map<string, WebSocket> = new Map(); // action_id → ws
  // Channel MCP sockets — one per active session_id (sessions can have only one channel)
  private channelSockets: Map<string, WebSocket> = new Map(); // session_id → channel ws
  // Reverse lookup — needed on close/error (where only ws is known)
  private socketToSession: WeakMap<WebSocket, string> = new WeakMap();
  private lastActivity: number = Date.now();

  async fetch(request: Request): Promise<Response> {
    this.lastActivity = Date.now();
    // Schedule cleanup alarm if not already set
    const currentAlarm = await this.ctx.storage.getAlarm();
    if (!currentAlarm) {
      await this.ctx.storage.setAlarm(Date.now() + IDLE_TTL_MS);
    }
    const url = new URL(request.url);

    // ── Browser WebSocket ────────────────────────────────────────
    if (url.pathname === "/ws") {
      return this.handleBrowserWebSocket();
    }

    // ── Action hook WebSocket ────────────────────────────────────
    if (url.pathname === "/ws/action") {
      return this.handleActionWebSocket();
    }

    // ── Channel MCP server WebSocket ─────────────────────────────
    if (url.pathname === "/ws/channel") {
      return this.handleChannelWebSocket();
    }

    // ── Event relay ──────────────────────────────────────────────
    if (url.pathname === "/event" && request.method === "POST") {
      const event = (await request.json()) as MonitorEvent;
      if (!event.session_id || event.session_id.startsWith("unknown")) {
        return new Response("skipped", { status: 200 });
      }
      this.broadcastToBrowsers({ type: "event", event });
      return new Response("ok", { status: 200 });
    }

    return new Response("not found", { status: 404 });
  }

  // ── Browser WebSocket ──────────────────────────────────────────

  private handleBrowserWebSocket(): Response {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server, ["browser"]);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ── Action Hook WebSocket ──────────────────────────────────────

  private handleActionWebSocket(): Response {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server, ["action"]);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ── Channel MCP server WebSocket ───────────────────────────────

  private handleChannelWebSocket(): Response {
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.ctx.acceptWebSocket(server, ["channel"]);
    return new Response(null, { status: 101, webSocket: client });
  }

  // ── Hibernation API callbacks ──────────────────────────────────

  async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    try {
      const data = JSON.parse(typeof msg === "string" ? msg : new TextDecoder().decode(msg));
      const tags = this.ctx.getTags(ws);
      const isAction = tags.includes("action");
      const isBrowser = tags.includes("browser");
      const isChannel = tags.includes("channel");

      // Ping/pong
      if (data.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", ts: Date.now() }));
        return;
      }

      // ── Channel MCP server registers its session_id on connect ──
      if (isChannel && data.type === "channel_identify" && typeof data.session_id === "string") {
        const sid = data.session_id;
        this.channelSockets.set(sid, ws);
        this.socketToSession.set(ws, sid);
        // Announce connectivity to all browsers
        this.broadcastToBrowsers({ type: "channel_status", session_id: sid, connected: true } as WsMessage);
        return;
      }

      // ── Browser sends a message to a session (via its channel socket) ──
      if (isBrowser && data.type === "channel_message" && typeof data.session_id === "string") {
        const channelWs = this.channelSockets.get(data.session_id);
        if (channelWs) {
          try {
            channelWs.send(
              JSON.stringify({
                type: "channel_message",
                session_id: data.session_id,
                content: data.content || "",
                user: data.user,
                source: data.source,
              }),
            );
          } catch {
            // Dead channel socket — will be cleaned up
          }
        }
        // Echo back to all browsers so message appears in thread immediately
        this.broadcastToBrowsers({
          type: "channel_message",
          session_id: data.session_id,
          content: data.content || "",
          user: data.user,
          source: data.source,
        } as WsMessage);
        return;
      }

      // ── Channel MCP server sends Claude's reply back to browsers ──
      if (isChannel && data.type === "channel_reply" && typeof data.session_id === "string") {
        this.broadcastToBrowsers({
          type: "channel_reply",
          session_id: data.session_id,
          content: data.content || "",
        } as WsMessage);
        return;
      }

      // Action hook sends an event for browser approval
      if (isAction && data.type === "action_request") {
        const id = crypto.randomUUID();
        const browserSockets = this.ctx.getWebSockets("browser");

        // If no browser connected, immediately tell the hook to fall through
        if (browserSockets.length === 0) {
          ws.send(JSON.stringify({ type: "no_browser" }));
          return;
        }

        // Store pending action
        const action: PendingAction = {
          id,
          session_id: data.session_id || "",
          hook_event_name: data.hook_event_name || "",
          event_data: data,
          created_at: Date.now(),
          hookWs: ws,
        };
        this.pendingActions.set(id, action);
        this.actionHookSockets.set(id, ws);

        // Broadcast action request to all browser clients
        const broadcastData = JSON.stringify({
          type: "action_request",
          action: { id, session_id: action.session_id, hook_event_name: action.hook_event_name, event_data: data },
        });
        for (const bws of browserSockets) {
          try {
            bws.send(broadcastData);
          } catch {}
        }

        // Auto-expire after 30s
        setTimeout(() => {
          const pending = this.pendingActions.get(id);
          if (pending) {
            this.pendingActions.delete(id);
            this.actionHookSockets.delete(id);
            try {
              pending.hookWs?.send(JSON.stringify({ type: "timeout" }));
            } catch {}
          }
        }, 30_000);

        return;
      }

      // Browser sends an action response (approve/deny)
      if (isBrowser && data.type === "action_response") {
        const actionId = data.action_id as string;
        const pending = this.pendingActions.get(actionId);
        if (pending) {
          // Relay response to the action hook's WebSocket
          const hookWs = this.actionHookSockets.get(actionId);
          if (hookWs) {
            try {
              hookWs.send(
                JSON.stringify({
                  type: "response",
                  hook_response: data.hook_response || {},
                }),
              );
            } catch {}
          }
          this.pendingActions.delete(actionId);
          this.actionHookSockets.delete(actionId);

          // Notify all browsers that the action is resolved
          this.broadcastToBrowsers({ type: "action_resolved" as any, action_id: actionId } as any);
        }
        return;
      }
    } catch {
      // ignore malformed messages
    }
  }

  async webSocketClose(ws: WebSocket) {
    this.cleanupSocket(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.cleanupSocket(ws);
  }

  private cleanupSocket(ws: WebSocket) {
    // Clean up any pending actions for this hook socket
    for (const [id, hookWs] of this.actionHookSockets) {
      if (hookWs === ws) {
        this.pendingActions.delete(id);
        this.actionHookSockets.delete(id);
      }
    }
    // Channel socket cleanup — O(1) via reverse lookup
    const sessionId = this.socketToSession.get(ws);
    if (sessionId && this.channelSockets.get(sessionId) === ws) {
      this.channelSockets.delete(sessionId);
      this.socketToSession.delete(ws);
      this.broadcastToBrowsers({ type: "channel_status", session_id: sessionId, connected: false } as WsMessage);
    }
  }

  // ── Alarm: self-destruct idle DOs ──────────────────────────────

  async alarm() {
    const idleMs = Date.now() - this.lastActivity;
    if (idleMs >= IDLE_TTL_MS) {
      // Close all remaining sockets
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.close(1000, "idle timeout");
        } catch {}
      }
      // Delete all storage to allow DO to be garbage collected
      await this.ctx.storage.deleteAll();
    } else {
      // Reschedule for remaining TTL
      await this.ctx.storage.setAlarm(Date.now() + (IDLE_TTL_MS - idleMs));
    }
  }

  // ── Broadcast to browser clients only ──────────────────────────

  private broadcastToBrowsers(msg: WsMessage) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets("browser")) {
      try {
        ws.send(data);
      } catch {
        // Dead socket — will be cleaned up by the runtime
      }
    }
  }
}
