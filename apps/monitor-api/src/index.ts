import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth } from "./auth";
import { apiKeyAuth, optionalCookieAuth, wsTokenAuth } from "./middleware";
import type { Env } from "./env";

export { SessionRoom } from "./session-room";

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
    allowHeaders: ["Content-Type", "Authorization", "Upgrade", "Connection"],
    credentials: true,
  }),
);

// ── Room routing (per-user or global) ────────────────────────────────

function getRoom(env: Env, userId?: string): DurableObjectStub {
  const name = env.SINGLE_USER === "true" || !userId || userId === "anonymous"
    ? "global"
    : `user:${userId}`;
  const id = env.SESSION_ROOM.idFromName(name);
  return env.SESSION_ROOM.get(id);
}

// ── Auth routes ──────────────────────────────────────────────────────

app.route("/", auth);

// ── Health ───────────────────────────────────────────────────────────

app.get("/health", (c) =>
  c.json({ status: "ok", service: "claudemon", version: "0.2.0" }),
);

// ── POST /events — receive hook events (requires API key) ───────────

app.post("/events", apiKeyAuth, async (c) => {
  const body = await c.req.json();
  const userId = c.get("userId");
  const room = getRoom(c.env, userId);
  await room.fetch(new Request("https://do/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }));
  return c.json({ ok: true });
});

// ── POST /events/batch — receive batched hook events ────────────────

app.post("/events/batch", apiKeyAuth, async (c) => {
  const events = await c.req.json() as unknown[];
  const userId = c.get("userId");
  const room = getRoom(c.env, userId);
  for (const event of events) {
    await room.fetch(new Request("https://do/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }));
  }
  return c.json({ ok: true, count: events.length });
});

// ── POST /events/webhook/github — GitHub dispatch relay ─────────────

app.post("/events/webhook/github", async (c) => {
  // Verify webhook secret
  const secret = c.req.header("X-Webhook-Secret");
  if (!c.env.WEBHOOK_SECRET || secret !== c.env.WEBHOOK_SECRET) {
    return c.json({ error: "Invalid webhook secret" }, 403);
  }

  const body = await c.req.json();
  const eventData = body.data || body;

  const room = getRoom(c.env, "anonymous");
  await room.fetch(new Request("https://do/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(eventData),
  }));

  return c.json({ ok: true });
});

// ── GET /sessions — list active sessions ────────────────────────────

app.get("/sessions", optionalCookieAuth, async (c) => {
  const room = getRoom(c.env, c.get("userId"));
  const res = await room.fetch(new Request("https://do/sessions"));
  return new Response(res.body, { headers: { "Content-Type": "application/json" } });
});

// ── POST /sessions/purge — clear all sessions ───────────────────────

app.post("/sessions/purge", optionalCookieAuth, async (c) => {
  const room = getRoom(c.env, c.get("userId"));
  const res = await room.fetch(new Request("https://do/sessions/purge", { method: "POST" }));
  return new Response(res.body, { headers: { "Content-Type": "application/json" } });
});

// ── DELETE /sessions/:id — archive a session ────────────────────────

app.delete("/sessions/:id", optionalCookieAuth, async (c) => {
  const id = c.req.param("id");
  const room = getRoom(c.env, c.get("userId"));
  const res = await room.fetch(new Request(`https://do/sessions/${id}`, { method: "DELETE" }));
  return new Response(res.body, { headers: { "Content-Type": "application/json" } });
});

// ── POST /cloud/register — manually register a cloud session ────────

app.post("/cloud/register", apiKeyAuth, async (c) => {
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

  const room = getRoom(c.env, c.get("userId"));
  await room.fetch(new Request("https://do/event", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id,
      machine_id: "cloud",
      project_path: project_path || "cloud-session",
      hook_event_name: "SessionStart",
      timestamp: Date.now(),
      model: model || "unknown",
      source: source || "cloud",
    }),
  }));

  return c.json({ ok: true, session_id });
});

// ── Serve hook script (no eval, safe auth header) ───────────────────

app.get("/hook.sh", async (c) => {
  const script = `#!/usr/bin/env bash
# ClaudeMon Hook — batching version (flushes every 2s)
set -euo pipefail
API_URL="\${CLAUDEMON_API_URL:-https://api.claudemon.com}"
API_KEY="\${CLAUDEMON_API_KEY:-}"
MACHINE_ID="$(hostname -s | tr '[:upper:]' '[:lower:]')"
TIMESTAMP="$(date +%s)000"
INPUT="$(cat)"
BRANCH=""; PROJECT_PATH="$PWD"
if git rev-parse --is-inside-work-tree &>/dev/null 2>&1; then
  BRANCH="$(git branch --show-current 2>/dev/null || true)"
  PROJECT_PATH="$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")"
fi
if command -v jq &>/dev/null; then
  PAYLOAD="$(echo "$INPUT" | jq -c --arg mid "$MACHINE_ID" --argjson ts "$TIMESTAMP" --arg pp "$PROJECT_PATH" --arg br "$BRANCH" '{session_id:.session_id,machine_id:$mid,timestamp:$ts,project_path:$pp,hook_event_name:.hook_event_name,branch:$br,tool_name:.tool_name,tool_input:.tool_input,tool_response:(.tool_response//null),tool_use_id:(.tool_use_id//null),model:(.model//null),permission_mode:(.permission_mode//null),cwd:(.cwd//null),transcript_path:(.transcript_path//null),last_assistant_message:(.last_assistant_message//null)} | with_entries(select(.value != null))')"
  SID="$(echo "$INPUT" | jq -r '.session_id // empty')"
else
  _esc() { printf '%s' "$1" | sed 's/\\\\/\\\\\\\\/g;s/"/\\\\"/g'; }
  SID="$(echo "$INPUT" | grep -o '"session_id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)"
  HEN="$(echo "$INPUT" | grep -o '"hook_event_name":"[^"]*"' | head -1 | cut -d'"' -f4 || true)"
  TN="$(echo "$INPUT" | grep -o '"tool_name":"[^"]*"' | head -1 | cut -d'"' -f4 || true)"
  TUID="$(echo "$INPUT" | grep -o '"tool_use_id":"[^"]*"' | head -1 | cut -d'"' -f4 || true)"
  SID="\${SID:-unknown-$$}"; HEN="\${HEN:-unknown}"
  PAYLOAD="{\\"session_id\\":\\"$(_esc "$SID")\\",\\"machine_id\\":\\"$(_esc "$MACHINE_ID")\\",\\"timestamp\\":$TIMESTAMP,\\"project_path\\":\\"$(_esc "$PROJECT_PATH")\\",\\"hook_event_name\\":\\"$(_esc "$HEN")\\""
  [ -n "$BRANCH" ] && PAYLOAD="$PAYLOAD,\\"branch\\":\\"$(_esc "$BRANCH")\\""
  [ -n "$TN" ] && PAYLOAD="$PAYLOAD,\\"tool_name\\":\\"$(_esc "$TN")\\""
  [ -n "$TUID" ] && PAYLOAD="$PAYLOAD,\\"tool_use_id\\":\\"$(_esc "$TUID")\\""
  PAYLOAD="$PAYLOAD}"
fi

# ── Batch: append payload to batch file ──────────────────────────────
BATCH_FILE="/tmp/claudemon-\${SID}.batch"
LOCK_FILE="/tmp/claudemon-flush-\${SID}.lock"
echo "$PAYLOAD" >> "$BATCH_FILE"

# ── Start flush loop if not already running ──────────────────────────
if ! [ -f "$LOCK_FILE" ]; then
  touch "$LOCK_FILE"
  (
    IDLE=0
    while [ $IDLE -lt 150 ]; do
      sleep 2
      if [ ! -s "$BATCH_FILE" ]; then
        IDLE=$((IDLE + 2))
        continue
      fi
      IDLE=0
      LINES="$(cat "$BATCH_FILE")"
      : > "$BATCH_FILE"
      BODY="[$(echo "$LINES" | paste -sd ',' -)]"
      CURL_ARGS=(-sf -X POST "$API_URL/events/batch" -H "Content-Type: application/json")
      [ -n "$API_KEY" ] && CURL_ARGS+=(-H "Authorization: Bearer $API_KEY")
      CURL_ARGS+=(-d "$BODY" --max-time 5)
      if ! curl "\${CURL_ARGS[@]}" >/dev/null 2>&1; then
        mkdir -p ~/.claudemon
        echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) batch flush failed" >> ~/.claudemon/last-error
      fi
    done
    rm -f "$LOCK_FILE"
  ) &
  disown
fi
exit 0`;
  return new Response(script, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
});

// ── Export — intercept WebSocket upgrades before Hono ────────────────

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Serve landing page at claudemon.com root
    if ((url.hostname === "claudemon.com" || url.hostname === "www.claudemon.com") && url.pathname === "/") {
      const { LANDING_HTML } = await import("./landing");
      return new Response(LANDING_HTML, {
        headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=3600" },
      });
    }

    // WebSocket upgrade — bypass Hono CORS, auth via cookie
    if (url.pathname === "/ws" && request.headers.get("Upgrade") === "websocket") {
      let userId = "anonymous";

      // Auth: cookie-based (browsers send cookies on WS upgrade)
      const cookie = request.headers.get("Cookie") || "";
      const match = cookie.match(/claudemon_token=([^;]+)/);
      if (match && env.JWT_SECRET) {
        const result = await wsTokenAuth(match[1], env.JWT_SECRET);
        if (result) userId = result.userId;
      }

      const room = getRoom(env, userId);
      return room.fetch(new Request("https://do/ws", {
        headers: request.headers,
      }));
    }

    return app.fetch(request, env, ctx);
  },
};

export default worker;
