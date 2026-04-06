// ── Transit Decryption (Signal Model) ─────────────────────────────
// Decrypts event payloads encrypted by the CLI before sending.
// Uses Web Crypto API — AES-256-GCM with PSK (Pre-Shared Key).

import type { EncryptedEnvelope } from "../../../../packages/types/monitor";

function base64ToAB(b64: string): ArrayBuffer {
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

function hexToAB(hex: string): ArrayBuffer {
  const buf = new ArrayBuffer(hex.length / 2);
  const view = new Uint8Array(buf);
  for (let i = 0; i < hex.length; i += 2) {
    view[i / 2] = Number.parseInt(hex.substring(i, i + 2), 16);
  }
  return buf;
}

function concatAB(a: ArrayBuffer, b: ArrayBuffer): ArrayBuffer {
  const result = new ArrayBuffer(a.byteLength + b.byteLength);
  const view = new Uint8Array(result);
  view.set(new Uint8Array(a), 0);
  view.set(new Uint8Array(b), a.byteLength);
  return result;
}

/**
 * Decrypt a transit-encrypted event envelope.
 * Returns the decrypted JSON object (sensitive fields).
 */
export async function decryptTransit(envelope: EncryptedEnvelope, keyHex: string): Promise<Record<string, unknown>> {
  const keyBuf = hexToAB(keyHex);

  if (envelope.alg === "aes-256-gcm") {
    const key = await crypto.subtle.importKey("raw", keyBuf, { name: "AES-GCM" }, false, ["decrypt"]);
    const iv = base64ToAB(envelope.iv);
    const ct = base64ToAB(envelope.ct);
    const tag = envelope.tag ? base64ToAB(envelope.tag) : new ArrayBuffer(0);

    // GCM: auth tag appended to ciphertext
    const combined = concatAB(ct, tag);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, combined);
    return JSON.parse(new TextDecoder().decode(plaintext));
  }

  if (envelope.alg === "aes-256-cbc-hmac") {
    const iv = base64ToAB(envelope.iv);
    const ct = base64ToAB(envelope.ct);

    // Verify HMAC-SHA256
    if (envelope.mac) {
      const macKey = await crypto.subtle.importKey("raw", keyBuf, { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
      const macData = new TextEncoder().encode(envelope.iv + envelope.ct);
      const expectedMac = hexToAB(envelope.mac);
      const valid = await crypto.subtle.verify("HMAC", macKey, expectedMac, macData);
      if (!valid) throw new Error("HMAC verification failed");
    }

    // Decrypt with AES-CBC
    const cbcKey = await crypto.subtle.importKey("raw", keyBuf, { name: "AES-CBC" }, false, ["decrypt"]);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, cbcKey, ct);
    return JSON.parse(new TextDecoder().decode(plaintext));
  }

  throw new Error(`Unsupported encryption algorithm: ${envelope.alg}`);
}

// ── Transit Key Storage ──────────────────────────────────────────

const TRANSIT_KEY_STORAGE = "claudemon_transit_key";

export function getTransitKey(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(TRANSIT_KEY_STORAGE);
}

export function setTransitKey(keyHex: string): void {
  localStorage.setItem(TRANSIT_KEY_STORAGE, keyHex);
}

export function clearTransitKey(): void {
  localStorage.removeItem(TRANSIT_KEY_STORAGE);
}
