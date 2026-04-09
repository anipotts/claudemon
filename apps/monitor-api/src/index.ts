import { Hono } from "hono";
import { cors } from "hono/cors";
import { auth, hashApiKey } from "./auth";
import { apiKeyAuth, wsTokenAuth } from "./middleware";
import { enrichEvent, isValidEvent, sendEvent } from "./events";
import type { Env } from "./env";

export { SessionRoom } from "./session-room";

// Constant-time string comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < bufA.length; i++) {
    result |= bufA[i] ^ bufB[i];
  }
  return result === 0;
}

const app = new Hono<{ Bindings: Env }>();

// ── Rate limiting (per-isolate, best-effort) ──────────────────────
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 200; // events per window
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

// Max payload size: 1MB
const MAX_PAYLOAD_BYTES = 1_048_576;

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

// -- Room routing (per-user or global) ------------------------------------

function getRoom(env: Env, userId?: string): DurableObjectStub {
  const name = env.SINGLE_USER === "true" || !userId || userId === "anonymous" ? "global" : `user:${userId}`;
  const id = env.SESSION_ROOM.idFromName(name);
  return env.SESSION_ROOM.get(id);
}

// -- Auth routes ----------------------------------------------------------

app.route("/", auth);

// -- Health ---------------------------------------------------------------

app.get("/health", (c) => c.json({ status: "ok", service: "claudemon", version: "0.6.0" }));

// -- POST /events -- receive hook events (requires API key) ---------------

app.post("/events", apiKeyAuth, async (c) => {
  const contentLength = parseInt(c.req.header("Content-Length") || "0", 10);
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return c.json({ error: "Payload too large (max 1MB)" }, 413);
  }

  const userId = c.get("userId");
  if (!checkRateLimit(userId)) {
    return c.json({ error: "Rate limit exceeded (200/min)" }, 429);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Malformed JSON" }, 400);
  }

  if (!isValidEvent(body)) {
    return c.json({ error: "Invalid event: requires session_id and hook_event_name" }, 400);
  }

  enrichEvent(body, userId);

  const room = getRoom(c.env, userId);
  await sendEvent(room, body);
  return c.json({});
});

// -- POST /events/batch -- receive batched hook events --------------------

app.post("/events/batch", apiKeyAuth, async (c) => {
  const contentLength = parseInt(c.req.header("Content-Length") || "0", 10);
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return c.json({ error: "Payload too large (max 1MB)" }, 413);
  }

  const userId = c.get("userId");
  if (!checkRateLimit(userId)) {
    return c.json({ error: "Rate limit exceeded (200/min)" }, 429);
  }

  let events: any;
  try {
    events = await c.req.json();
  } catch {
    return c.json({ error: "Malformed JSON" }, 400);
  }

  if (!Array.isArray(events)) {
    return c.json({ error: "Request body must be a JSON array" }, 400);
  }

  const room = getRoom(c.env, userId);

  let count = 0;
  for (const event of events) {
    if (!isValidEvent(event)) continue;
    enrichEvent(event, userId);
    await sendEvent(room, event);
    count++;
  }
  return c.json({ count });
});

// -- POST /events/webhook/github -- GitHub dispatch relay -----------------

app.post("/events/webhook/github", async (c) => {
  const secret = c.req.header("X-Webhook-Secret") || "";
  if (!c.env.WEBHOOK_SECRET || !timingSafeEqual(secret, c.env.WEBHOOK_SECRET)) {
    return c.json({ error: "Invalid webhook secret" }, 403);
  }

  let body: any;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Malformed JSON" }, 400);
  }

  const eventData = body.data || body;
  const room = getRoom(c.env, "anonymous");
  await sendEvent(room, eventData);
  return c.json({ ok: true });
});

// Sessions are now managed client-side in IndexedDB — no server-side session routes.

// -- POST /cloud/register -- manually register a cloud session ------------

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
  await sendEvent(room, {
    session_id,
    machine_id: "cloud",
    project_path: project_path || "cloud-session",
    hook_event_name: "SessionStart",
    timestamp: Date.now(),
    model: model || "unknown",
    source: source || "cloud",
  });

  return c.json({ ok: true, session_id });
});

// -- Serve hook script (no eval, safe auth header) ------------------------

app.get("/hook.sh", async (_c) => {
  const script = `#!/usr/bin/env bash
# ClaudeMon Hook -- batching version (flushes every 2s)
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

# -- Batch: append payload to batch file -----------------------------------
BATCH_FILE="/tmp/claudemon-\${SID}.batch"
LOCK_FILE="/tmp/claudemon-flush-\${SID}.lock"
echo "$PAYLOAD" >> "$BATCH_FILE"

# -- Start flush loop if not already running -------------------------------
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

// -- Export -- intercept WebSocket upgrades before Hono --------------------

const worker = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Serve landing page at claudemon.com root
    if ((url.hostname === "claudemon.com" || url.hostname === "www.claudemon.com") && url.pathname === "/") {
      const { LANDING_HTML } = await import("./landing");
      return new Response(LANDING_HTML, {
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
          "Content-Security-Policy":
            "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self' wss://api.claudemon.com https://api.claudemon.com; img-src 'self' data: https://avatars.githubusercontent.com",
          "X-Content-Type-Options": "nosniff",
          "X-Frame-Options": "DENY",
        },
      });
    }

    // WebSocket upgrade -- bypass Hono CORS, auth via cookie or API key
    const isWsUpgrade = request.headers.get("Upgrade") === "websocket";
    const isWsPath = url.pathname === "/ws" || url.pathname === "/ws/action";
    if (isWsPath && isWsUpgrade) {
      let userId = "anonymous";

      // Try cookie auth first
      const cookie = request.headers.get("Cookie") || "";
      const match = cookie.match(/claudemon_token=([^;]+)/);
      if (match && env.JWT_SECRET) {
        const result = await wsTokenAuth(match[1], env.JWT_SECRET);
        if (result) userId = result.userId;
      }

      // Fallback: API key in query param (cross-origin WebSocket may not carry cookies)
      if (userId === "anonymous") {
        const token = url.searchParams.get("token");
        if (token?.startsWith("cm_")) {
          const hash = await hashApiKey(token);
          const raw = await env.API_KEYS.get(`key:${hash}`);
          if (raw) {
            const data = JSON.parse(raw) as { user_id: string };
            userId = data.user_id;
          }
        }
      }

      // Reject anonymous WebSocket connections (require auth)
      if (userId === "anonymous" && env.SINGLE_USER !== "true") {
        return new Response("Authentication required for WebSocket", { status: 401 });
      }

      const room = getRoom(env, userId);
      const doPath = url.pathname === "/ws/action" ? "/ws/action" : "/ws";
      return room.fetch(
        new Request(`https://do${doPath}`, {
          headers: request.headers,
        }),
      );
    }

    return app.fetch(request, env, ctx);
  },
};

export default worker;
