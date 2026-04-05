import type { Context, Next } from "hono";
import { verifyJwt, hashApiKey } from "./auth";
import type { JwtPayload } from "./auth";
import type { Env } from "./env";

// Extend Hono context with userId
declare module "hono" {
  interface ContextVariableMap {
    userId: string;
    userPayload: JwtPayload;
  }
}

// ── Cookie-based auth (strict — 401 if not authenticated) ────────────

export async function cookieAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const cookie = c.req.header("Cookie") || "";
  const match = cookie.match(/claudemon_token=([^;]+)/);
  if (!match) return c.json({ error: "Not authenticated" }, 401);

  const payload = await verifyJwt(match[1], c.env.JWT_SECRET);
  if (!payload) return c.json({ error: "Invalid or expired token" }, 401);

  c.set("userId", payload.sub);
  c.set("userPayload", payload);
  return next();
}

// ── Cookie-based auth (optional — falls back to anonymous) ───────────

export async function optionalCookieAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const cookie = c.req.header("Cookie") || "";
  const match = cookie.match(/claudemon_token=([^;]+)/);
  if (match) {
    const payload = await verifyJwt(match[1], c.env.JWT_SECRET);
    if (payload) {
      c.set("userId", payload.sub);
      c.set("userPayload", payload);
      return next();
    }
  }
  c.set("userId", "anonymous");
  return next();
}

// ── API key auth (hook routes — required) ────────────────────────────

export async function apiKeyAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header("Authorization");

  // In SINGLE_USER mode, skip auth
  if (c.env.SINGLE_USER === "true") {
    c.set("userId", "anonymous");
    return next();
  }

  if (!authHeader) {
    return c.json({ error: "API key required. Run: npx claudemon init" }, 401);
  }

  const key = authHeader.replace(/^Bearer\s+/i, "");
  if (!key.startsWith("cm_")) {
    return c.json({ error: "Invalid API key format" }, 401);
  }

  const hash = await hashApiKey(key);
  const raw = await c.env.API_KEYS.get(`key:${hash}`);
  if (!raw) return c.json({ error: "Invalid API key" }, 401);

  const data = JSON.parse(raw) as { user_id: string };
  c.set("userId", data.user_id);
  return next();
}

// ── WebSocket token auth (from cookie or token param) ────────────────

export async function wsTokenAuth(
  token: string | null,
  jwtSecret: string,
): Promise<{ userId: string; payload: JwtPayload } | null> {
  if (!token) return null;
  const payload = await verifyJwt(token, jwtSecret);
  if (!payload) return null;
  return { userId: payload.sub, payload };
}
