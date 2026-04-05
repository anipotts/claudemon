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
});
