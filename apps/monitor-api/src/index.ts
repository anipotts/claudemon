import { Hono } from "hono";
import { cors } from "hono/cors";

export { SessionRoom } from "./session-room";

interface Env {
  SESSION_ROOM: DurableObjectNamespace;
}

const app = new Hono<{ Bindings: Env }>();

app.use(
  "*",
  cors({
    origin: [
      "https://app.claudemon.com",
      "https://staging.claudemon.com",
      "https://claudemon.com",
      "https://claudemon.pages.dev",
      "http://localhost:5173",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:1420",
      "tauri://localhost",
    ],
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Upgrade", "Connection"],
  }),
);

// Use a single Durable Object instance as a global room
// (for single-user use; shard by user_id for multi-tenant later)
function getRoom(env: Env): DurableObjectStub {
  const id = env.SESSION_ROOM.idFromName("global");
  return env.SESSION_ROOM.get(id);
}

// Health
app.get("/health", (c) =>
  c.json({ status: "ok", service: "claudemon", version: "0.1.0" }),
);

// POST /events — receive hook events, forward to Durable Object
app.post("/events", async (c) => {
  const body = await c.req.json();
  const room = getRoom(c.env);
  const res = await room.fetch(new Request("https://do/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
  return c.json({ ok: true }, res.status as 200);
});

// GET /ws — WebSocket upgrade, proxied to Durable Object
app.get("/ws", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader !== "websocket") {
    return c.text("Expected WebSocket", 426);
  }
  const room = getRoom(c.env);
  return room.fetch(new Request("https://do/ws", {
    headers: c.req.raw.headers,
  }));
});

// GET /sessions — list active sessions
app.get("/sessions", async (c) => {
  const room = getRoom(c.env);
  const res = await room.fetch(new Request("https://do/sessions"));
  return new Response(res.body, { headers: { "Content-Type": "application/json" } });
});

// POST /sessions/purge — clear all sessions
app.post("/sessions/purge", async (c) => {
  const room = getRoom(c.env);
  const res = await room.fetch(new Request("https://do/sessions/purge", { method: "POST" }));
  return new Response(res.body, { headers: { "Content-Type": "application/json" } });
});

// DELETE /sessions/:id — archive a session
app.delete("/sessions/:id", async (c) => {
  const id = c.req.param("id");
  const room = getRoom(c.env);
  const res = await room.fetch(new Request(`https://do/sessions/${id}`, { method: "DELETE" }));
  return new Response(res.body, { headers: { "Content-Type": "application/json" } });
});

// POST /cloud/register — manually register a cloud session (for sessions without hooks)
app.post("/cloud/register", async (c) => {
  const body = await c.req.json();
  const { session_id, model, project_path, source } = body as {
    session_id: string;
    model?: string;
    project_path?: string;
    source?: string;
  };

  if (!session_id) {
    return c.json({ error: "session_id is required" }, 400);
  }

  const event = {
    session_id,
    machine_id: "cloud",
    project_path: project_path || "cloud-session",
    hook_event_name: "SessionStart",
    timestamp: Date.now(),
    model: model || "unknown",
    source: source || "cloud",
  };

  const room = getRoom(c.env);
  await room.fetch(new Request("https://do/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  }));

  return c.json({ ok: true, session_id });
});

// Serve hook script for easy install — mirrors the latest ~/.claudemon-hook.sh
app.get("/hook.sh", async (c) => {
  const script = `#!/usr/bin/env bash
# OpenProof Monitor Hook — all data from JSON stdin, not env vars
set -euo pipefail
API_URL="\${OPENPROOF_MONITOR_URL:-https://claudemon.anipotts.workers.dev}"
MACHINE_ID="$(hostname -s | tr '[:upper:]' '[:lower:]')"
TIMESTAMP="$(date +%s)000"
INPUT="$(cat)"
BRANCH=""; PROJECT_PATH="$PWD"
if git rev-parse --is-inside-work-tree &>/dev/null 2>&1; then
  BRANCH="$(git branch --show-current 2>/dev/null || true)"
  PROJECT_PATH="$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")"
fi
if command -v jq &>/dev/null; then
  PAYLOAD="$(echo "$INPUT" | jq -c --arg mid "$MACHINE_ID" --argjson ts "$TIMESTAMP" --arg pp "$PROJECT_PATH" --arg br "$BRANCH" '{session_id:.session_id,machine_id:$mid,timestamp:$ts,project_path:$pp,hook_event_name:.hook_event_name,branch:$br,tool_name:.tool_name,tool_input:.tool_input,tool_response:(.tool_response//null),model:(.model//null),permission_mode:(.permission_mode//null),cwd:(.cwd//null),transcript_path:(.transcript_path//null)} | with_entries(select(.value != null))')"
else
  SID="$(echo "$INPUT" | grep -o '"session_id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)"
  HEN="$(echo "$INPUT" | grep -o '"hook_event_name":"[^"]*"' | head -1 | cut -d'"' -f4 || true)"
  TN="$(echo "$INPUT" | grep -o '"tool_name":"[^"]*"' | head -1 | cut -d'"' -f4 || true)"
  FP="$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | cut -d'"' -f4 || true)"
  SID="\${SID:-unknown-$$}"; HEN="\${HEN:-unknown}"
  PAYLOAD="{\\"session_id\\":\\"$SID\\",\\"machine_id\\":\\"$MACHINE_ID\\",\\"timestamp\\":$TIMESTAMP,\\"project_path\\":\\"$PROJECT_PATH\\",\\"hook_event_name\\":\\"$HEN\\""
  [ -n "$BRANCH" ] && PAYLOAD="$PAYLOAD,\\"branch\\":\\"$BRANCH\\""
  [ -n "$TN" ] && PAYLOAD="$PAYLOAD,\\"tool_name\\":\\"$TN\\""
  [ -n "$FP" ] && PAYLOAD="$PAYLOAD,\\"tool_input\\":{\\"file_path\\":\\"$FP\\"}"
  PAYLOAD="$PAYLOAD}"
fi
curl -sf -X POST "$API_URL/events" -H "Content-Type: application/json" -d "$PAYLOAD" --max-time 2 >/dev/null 2>&1 &
exit 0`;
  return new Response(script, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
});

// Export a fetch handler that intercepts WebSocket upgrades before Hono
// (Hono's CORS middleware can interfere with the 101 Switching Protocols response)
const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade — bypass Hono, go direct to Durable Object
    if (url.pathname === "/ws" && request.headers.get("Upgrade") === "websocket") {
      const id = env.SESSION_ROOM.idFromName("global");
      const room = env.SESSION_ROOM.get(id);
      return room.fetch(new Request("https://do/ws", {
        headers: request.headers,
      }));
    }

    // Everything else goes through Hono
    return app.fetch(request, env, ctx);
  },
};

export default worker;
