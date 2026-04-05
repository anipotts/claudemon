import { Hono } from "hono";
import type { Env } from "./env";

interface JwtPayload {
  sub: string;        // "github:<user_id>"
  name: string;
  login: string;
  avatar_url: string;
  iat: number;
  exp: number;
}

// ── JWT helpers (crypto.subtle, no deps) ─────────────────────────────

const encoder = new TextEncoder();

function base64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "==".slice(0, (4 - (s.length % 4)) % 4);
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signJwt(payload: JwtPayload, secret: string): Promise<string> {
  const header = base64url(encoder.encode(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  const key = await getSigningKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(`${header}.${body}`));
  return `${header}.${body}.${base64url(sig)}`;
}

async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const key = await getSigningKey(secret);
  const valid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64urlDecode(parts[2]).buffer as ArrayBuffer,
    encoder.encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) return null;
  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1]))) as JwtPayload;
  if (payload.exp < Date.now() / 1000) return null;
  return payload;
}

// ── API Key helpers ──────────────────────────────────────────────────

async function hashApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(key));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return "cm_" + base64url(bytes);
}

// ── CSRF state token ─────────────────────────────────────────────────

function generateCsrfState(redirect?: string): string {
  const nonce = base64url(crypto.getRandomValues(new Uint8Array(16)));
  // Encode redirect in the state so we can recover it in the callback
  return redirect ? `${nonce}:${redirect}` : nonce;
}

function parseCsrfState(state: string): { nonce: string; redirect: string } {
  const idx = state.indexOf(":");
  if (idx === -1) return { nonce: state, redirect: "/" };
  return { nonce: state.slice(0, idx), redirect: state.slice(idx + 1) };
}

// Validate redirect is safe (path-only or our domains)
const ALLOWED_REDIRECT_HOSTS = new Set(["app.claudemon.com", "staging.claudemon.com", "claudemon.com", "localhost"]);
function isSafeRedirect(url: string): boolean {
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  try {
    const parsed = new URL(url);
    return ALLOWED_REDIRECT_HOSTS.has(parsed.hostname);
  } catch {
    return false;
  }
}

// ── Auth routes ──────────────────────────────────────────────────────

const auth = new Hono<{ Bindings: Env }>();

// GitHub OAuth login redirect
auth.get("/auth/login", async (c) => {
  const redirectUri = new URL(c.req.url).origin + "/auth/callback";
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", c.env.GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", "read:user");

  // CSRF state with optional redirect
  const redirect = c.req.query("redirect");
  const state = generateCsrfState(redirect);

  // Store nonce in KV for validation (5 min TTL)
  const { nonce } = parseCsrfState(state);
  await c.env.API_KEYS.put(`csrf:${nonce}`, "1", { expirationTtl: 300 });

  url.searchParams.set("state", state);
  return c.redirect(url.toString());
});

// GitHub OAuth callback → mint JWT → set cookie → redirect
auth.get("/auth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state") || "";
  if (!code) return c.text("Missing code", 400);

  // Validate CSRF state
  const { nonce, redirect } = parseCsrfState(state);
  const csrfValid = await c.env.API_KEYS.get(`csrf:${nonce}`);
  if (!csrfValid) return c.text("Invalid or expired state parameter", 400);
  await c.env.API_KEYS.delete(`csrf:${nonce}`);

  // Validate redirect target
  const redirectTo = isSafeRedirect(redirect) ? redirect : "/";

  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: c.env.GITHUB_CLIENT_ID,
      client_secret: c.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
  if (!tokenData.access_token) return c.text("Authentication failed", 400);

  // Fetch user info
  const userRes = await fetch("https://api.github.com/user", {
    headers: { Authorization: `Bearer ${tokenData.access_token}`, "User-Agent": "ClaudeMon" },
  });
  const user = (await userRes.json()) as { id: number; login: string; name: string; avatar_url: string };

  // Mint JWT (1 hour)
  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJwt(
    {
      sub: `github:${user.id}`,
      name: user.name || user.login,
      login: user.login,
      avatar_url: user.avatar_url,
      iat: now,
      exp: now + 2592000, // 30 days
    },
    c.env.JWT_SECRET,
  );

  const isLocal = new URL(c.req.url).hostname === "localhost";
  const cookie = [
    `claudemon_token=${jwt}`,
    "HttpOnly",
    isLocal ? "" : "Secure",
    "SameSite=Lax",
    "Max-Age=2592000",
    "Path=/",
  ].filter(Boolean).join("; ");

  const location = redirectTo.startsWith("http") ? redirectTo : `https://app.claudemon.com${redirectTo}`;
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Set-Cookie": cookie },
  });
});

// Logout — clear cookie
auth.get("/auth/logout", (c) => {
  return new Response(null, {
    status: 302,
    headers: {
      Location: "https://claudemon.com",
      "Set-Cookie": "claudemon_token=; HttpOnly; Secure; SameSite=Lax; Max-Age=0; Path=/",
    },
  });
});

// Get current user from JWT cookie
auth.get("/auth/me", async (c) => {
  const cookie = c.req.header("Cookie") || "";
  const match = cookie.match(/claudemon_token=([^;]+)/);
  if (!match) return c.json({ error: "Not authenticated" }, 401);

  const payload = await verifyJwt(match[1], c.env.JWT_SECRET);
  if (!payload) return c.json({ error: "Invalid or expired token" }, 401);

  // Refresh if <10 min remaining
  const remaining = payload.exp - Date.now() / 1000;
  const headers: Record<string, string> = {};
  if (remaining < 600) {
    const now = Math.floor(Date.now() / 1000);
    const newJwt = await signJwt({ ...payload, iat: now, exp: now + 3600 }, c.env.JWT_SECRET);
    const isLocal = new URL(c.req.url).hostname === "localhost";
    headers["Set-Cookie"] = [
      `claudemon_token=${newJwt}`,
      "HttpOnly",
      isLocal ? "" : "Secure",
      "SameSite=Lax",
      "Max-Age=2592000",
      "Path=/",
    ].filter(Boolean).join("; ");
  }

  return c.json(
    { sub: payload.sub, name: payload.name, login: payload.login, avatar_url: payload.avatar_url },
    200,
    headers,
  );
});

// ── API Keys ─────────────────────────────────────────────────────────

auth.post("/auth/api-keys", async (c) => {
  const cookie = c.req.header("Cookie") || "";
  const match = cookie.match(/claudemon_token=([^;]+)/);
  if (!match) return c.json({ error: "Not authenticated" }, 401);
  const payload = await verifyJwt(match[1], c.env.JWT_SECRET);
  if (!payload) return c.json({ error: "Invalid token" }, 401);

  const { label } = (await c.req.json().catch(() => ({}))) as { label?: string };
  const key = generateApiKey();
  const hash = await hashApiKey(key);

  await c.env.API_KEYS.put(`key:${hash}`, JSON.stringify({
    user_id: payload.sub,
    label: label || "default",
    created_at: Date.now(),
  }));

  const userKeysRaw = await c.env.API_KEYS.get(`user:${payload.sub}:keys`);
  const userKeys: string[] = userKeysRaw ? JSON.parse(userKeysRaw) : [];
  userKeys.push(hash);
  await c.env.API_KEYS.put(`user:${payload.sub}:keys`, JSON.stringify(userKeys));

  return c.json({ key, hash: hash.slice(0, 8), label: label || "default" });
});

auth.get("/auth/api-keys", async (c) => {
  const cookie = c.req.header("Cookie") || "";
  const match = cookie.match(/claudemon_token=([^;]+)/);
  if (!match) return c.json({ error: "Not authenticated" }, 401);
  const payload = await verifyJwt(match[1], c.env.JWT_SECRET);
  if (!payload) return c.json({ error: "Invalid token" }, 401);

  const userKeysRaw = await c.env.API_KEYS.get(`user:${payload.sub}:keys`);
  const userKeys: string[] = userKeysRaw ? JSON.parse(userKeysRaw) : [];

  const keys = await Promise.all(
    userKeys.map(async (hash) => {
      const raw = await c.env.API_KEYS.get(`key:${hash}`);
      if (!raw) return null;
      const data = JSON.parse(raw) as { label: string; created_at: number };
      return { hash: hash.slice(0, 8), label: data.label, created_at: data.created_at };
    }),
  );

  return c.json({ keys: keys.filter(Boolean) });
});

auth.delete("/auth/api-keys/:hash", async (c) => {
  const cookie = c.req.header("Cookie") || "";
  const match = cookie.match(/claudemon_token=([^;]+)/);
  if (!match) return c.json({ error: "Not authenticated" }, 401);
  const payload = await verifyJwt(match[1], c.env.JWT_SECRET);
  if (!payload) return c.json({ error: "Invalid token" }, 401);

  const hashPrefix = c.req.param("hash");
  const userKeysRaw = await c.env.API_KEYS.get(`user:${payload.sub}:keys`);
  const userKeys: string[] = userKeysRaw ? JSON.parse(userKeysRaw) : [];

  const fullHash = userKeys.find((h) => h.startsWith(hashPrefix));
  if (!fullHash) return c.json({ error: "Key not found" }, 404);

  await c.env.API_KEYS.delete(`key:${fullHash}`);
  const updated = userKeys.filter((h) => h !== fullHash);
  await c.env.API_KEYS.put(`user:${payload.sub}:keys`, JSON.stringify(updated));

  return c.json({ ok: true });
});

// ── Exports ──────────────────────────────────────────────────────────

export { auth, verifyJwt, hashApiKey };
export type { JwtPayload };
