#!/usr/bin/env npx tsx
/**
 * ClaudeMon MCP server + channel — bidirectional bridge between the dashboard and this session.
 *
 * Declares `claude/channel` capability. Messages from the dashboard arrive as
 * <channel source="claudemon" user="..."> notifications. Claude replies via
 * the `reply` tool, which routes back through the WebSocket to the DO and
 * broadcasts to all browser clients viewing this session.
 *
 * Transport: persistent WebSocket to wss://api.claudemon.com/ws/channel
 * Reconnect: exponential backoff, same pattern as apps/monitor/src/stores/websocket.ts
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const API_URL = process.env.CLAUDEMON_API_URL || "https://api.claudemon.com";
const API_KEY = process.env.CLAUDE_PLUGIN_OPTION_API_KEY || "";
const SESSION_ID = process.env.CLAUDE_SESSION_ID || "";

let ws: WebSocket | null = null;
let reconnectDelay = 1000;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function text(s: string) {
  return { content: [{ type: "text" as const, text: s }] };
}

// --- Server ---

const server = new Server(
  { name: "claudemon", version: "0.7.0" },
  {
    capabilities: {
      experimental: { "claude/channel": {} },
      tools: {},
    },
    instructions:
      "Messages from the ClaudeMon dashboard arrive as " +
      '<channel source="claudemon" user="..."> notifications. ' +
      "Read and acknowledge them. To reply back to the dashboard, use the " +
      "`reply` tool with the text you want displayed in the dashboard's session thread.",
  },
);

// --- Single tool: reply ---

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "reply",
      description:
        "Reply to the ClaudeMon dashboard. The text appears in the session's message thread in the browser.",
      inputSchema: {
        type: "object" as const,
        properties: {
          text: { type: "string", description: "The reply text to display in the dashboard" },
        },
        required: ["text"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments || {}) as Record<string, string>;

  if (req.params.name === "reply") {
    if (!args.text) return text("`text` is required.");
    if (!SESSION_ID) return text("No session_id — channel cannot route reply.");

    const sent = sendWs({ type: "channel_reply", session_id: SESSION_ID, content: args.text });
    return text(sent ? "Reply sent." : "Reply queued — channel not yet connected.");
  }

  return text(`Unknown tool: ${req.params.name}`);
});

// --- Connect transport ---

const transport = new StdioServerTransport();
await server.connect(transport);

// --- Channel WebSocket with reconnect ---

function sendWs(payload: Record<string, unknown>): boolean {
  if (ws && ws.readyState === 1 /* OPEN */) {
    ws.send(JSON.stringify(payload));
    return true;
  }
  return false;
}

function connectWs() {
  if (!SESSION_ID) {
    process.stderr.write("claudemon: CLAUDE_SESSION_ID not set, channel disabled\n");
    return;
  }
  if (!API_KEY) {
    process.stderr.write("claudemon: CLAUDE_PLUGIN_OPTION_API_KEY not set, channel disabled\n");
    return;
  }

  const url = `${API_URL.replace(/^http/, "ws")}/ws/channel?token=${encodeURIComponent(API_KEY)}`;

  try {
    ws = new WebSocket(url);
  } catch (err) {
    process.stderr.write(`claudemon: ws construct failed: ${err}\n`);
    scheduleReconnect();
    return;
  }

  ws.addEventListener("open", () => {
    reconnectDelay = 1000;
    sendWs({ type: "channel_identify", session_id: SESSION_ID });
  });

  ws.addEventListener("message", (e: MessageEvent) => {
    try {
      const data = JSON.parse(typeof e.data === "string" ? e.data : "{}");

      if (data.type === "channel_message" && data.content) {
        // Push into Claude's context as a channel notification
        server.notification({
          method: "notifications/claude/channel",
          params: {
            content: data.content,
            meta: {
              user: data.user || "dashboard",
              source: data.source || "dashboard",
            },
          },
        });
      }

      if (data.type === "pong") {
        // keep-alive response, no-op
      }
    } catch {
      // ignore malformed
    }
  });

  ws.addEventListener("close", () => {
    ws = null;
    scheduleReconnect();
  });

  ws.addEventListener("error", () => {
    try {
      ws?.close();
    } catch {}
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectWs();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, 30_000);
}

// Keep-alive ping every 30s
setInterval(() => {
  sendWs({ type: "ping", ts: Date.now() });
}, 30_000);

connectWs();
