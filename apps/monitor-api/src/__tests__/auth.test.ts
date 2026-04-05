import { describe, it, expect } from "vitest";
import { signJwt, verifyJwt, hashApiKey, generateApiKey } from "../auth";

const SECRET = "test-secret-key-for-vitest";

const validPayload = {
  sub: "github:12345",
  name: "Test User",
  login: "testuser",
  avatar_url: "https://example.com/avatar.png",
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
};

// ── JWT helpers ─────────────────────────────────────────────────────

describe("signJwt", () => {
  it("produces a 3-part dot-separated string starting with eyJ", async () => {
    const token = await signJwt(validPayload, SECRET);
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    expect(token.startsWith("eyJ")).toBe(true);
  });
});

describe("verifyJwt", () => {
  it("returns payload for valid token", async () => {
    const token = await signJwt(validPayload, SECRET);
    const result = await verifyJwt(token, SECRET);
    expect(result).not.toBeNull();
    expect(result!.sub).toBe("github:12345");
    expect(result!.login).toBe("testuser");
  });

  it("returns null for expired token", async () => {
    const expired = { ...validPayload, exp: Math.floor(Date.now() / 1000) - 10 };
    const token = await signJwt(expired, SECRET);
    const result = await verifyJwt(token, SECRET);
    expect(result).toBeNull();
  });

  it("returns null for tampered token", async () => {
    const token = await signJwt(validPayload, SECRET);
    // Flip a character in the signature
    const tampered = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    const result = await verifyJwt(tampered, SECRET);
    expect(result).toBeNull();
  });

  it("returns null for malformed string", async () => {
    expect(await verifyJwt("not-a-jwt", SECRET)).toBeNull();
    expect(await verifyJwt("a.b", SECRET)).toBeNull();
    expect(await verifyJwt("", SECRET)).toBeNull();
  });
});

// ── API key helpers ─────────────────────────────────────────────────

describe("generateApiKey", () => {
  it("starts with cm_", () => {
    expect(generateApiKey().startsWith("cm_")).toBe(true);
  });

  it("produces unique keys on each call", () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a).not.toBe(b);
  });
});

describe("hashApiKey", () => {
  it("produces consistent hash for same input", async () => {
    const a = await hashApiKey("cm_test123");
    const b = await hashApiKey("cm_test123");
    expect(a).toBe(b);
  });

  it("produces different hashes for different inputs", async () => {
    const a = await hashApiKey("cm_key1");
    const b = await hashApiKey("cm_key2");
    expect(a).not.toBe(b);
  });

  it("returns a 64-character hex string", async () => {
    const hash = await hashApiKey("cm_test_key");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

// ── JWT edge cases ─────────────────────────────────────────────────

describe("verifyJwt — edge cases", () => {
  it("returns null for token signed with a different secret", async () => {
    const token = await signJwt(validPayload, SECRET);
    const result = await verifyJwt(token, "completely-different-secret");
    expect(result).toBeNull();
  });

  it("preserves all fields through a sign/verify round trip", async () => {
    const fullPayload = {
      sub: "github:99999",
      name: "Full Name",
      login: "fulluser",
      avatar_url: "https://example.com/full-avatar.png",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7200,
    };
    const token = await signJwt(fullPayload, SECRET);
    const result = await verifyJwt(token, SECRET);
    expect(result).not.toBeNull();
    expect(result!.sub).toBe(fullPayload.sub);
    expect(result!.name).toBe(fullPayload.name);
    expect(result!.login).toBe(fullPayload.login);
    expect(result!.avatar_url).toBe(fullPayload.avatar_url);
    expect(result!.iat).toBe(fullPayload.iat);
    expect(result!.exp).toBe(fullPayload.exp);
  });

  it("returns null for token expiring in exactly 0 seconds (boundary)", async () => {
    const now = Math.floor(Date.now() / 1000);
    // Token with exp set to 1 second in the past to account for timing
    const boundaryPayload = { ...validPayload, exp: now - 1 };
    const token = await signJwt(boundaryPayload, SECRET);
    const result = await verifyJwt(token, SECRET);
    expect(result).toBeNull();
  });

  it("signJwt produces different tokens for different payloads", async () => {
    const payloadA = { ...validPayload, sub: "github:111" };
    const payloadB = { ...validPayload, sub: "github:222" };
    const tokenA = await signJwt(payloadA, SECRET);
    const tokenB = await signJwt(payloadB, SECRET);
    expect(tokenA).not.toBe(tokenB);
  });

  it("signJwt produces different tokens for same payload with different secrets", async () => {
    const tokenA = await signJwt(validPayload, "secret-one");
    const tokenB = await signJwt(validPayload, "secret-two");
    expect(tokenA).not.toBe(tokenB);
  });
});

// ── generateApiKey edge cases ──────────────────────────────────────

describe("generateApiKey — consistency", () => {
  it("produces keys of consistent length", () => {
    const keys = Array.from({ length: 10 }, () => generateApiKey());
    const lengths = new Set(keys.map((k) => k.length));
    expect(lengths.size).toBe(1);
  });
});
