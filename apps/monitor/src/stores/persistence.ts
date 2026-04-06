// ── IndexedDB Persistence Layer ─────────────────────────────────
// Local-first storage for ClaudeMon events and sessions.
// All data lives in the browser — server is a pure relay.
// Events are encrypted at rest with a non-exportable device-bound AES-GCM key.

import type { MonitorEvent, SessionState, HookEventName } from "../../../../packages/types/monitor";

const DB_NAME = "claudemon";
const DB_VERSION = 1;

// 7 days for normal events, 30 days for errors
const NORMAL_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
const ERROR_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const PRUNE_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// ── Signal Tier System ────────────────────────────────────────────

const TIER_MAP: Record<HookEventName, 1 | 2 | 3 | 4> = {
  PermissionRequest: 1,
  Notification: 1,
  Elicitation: 1,
  StopFailure: 1,
  PostToolUseFailure: 1,
  SessionStart: 2,
  SessionEnd: 2,
  Stop: 2,
  UserPromptSubmit: 2,
  PreToolUse: 2,
  PostToolUse: 2,
  SubagentStart: 2,
  SubagentStop: 2,
  PostCompact: 2,
  PermissionDenied: 2,
  PreCompact: 3,
  CwdChanged: 3,
  FileChanged: 3,
  ConfigChange: 3,
  WorktreeCreate: 3,
  WorktreeRemove: 3,
  InstructionsLoaded: 3,
  Setup: 3,
  TaskCreated: 4,
  TaskCompleted: 4,
  TeammateIdle: 4,
  ElicitationResult: 4,
};

export function getEventTier(eventName: HookEventName): 1 | 2 | 3 | 4 {
  return TIER_MAP[eventName] || 3;
}

// Error events get longer retention
const ERROR_EVENTS = new Set<HookEventName>(["PostToolUseFailure", "StopFailure"]);

function isErrorEvent(event: MonitorEvent): boolean {
  if (ERROR_EVENTS.has(event.hook_event_name)) return true;
  // Bash with non-zero exit code
  if (event.tool_name === "Bash" && event.tool_response) {
    const resp = event.tool_response as Record<string, unknown>;
    if (resp.exitCode && resp.exitCode !== 0) return true;
    if (resp.exit_code && resp.exit_code !== 0) return true;
  }
  return false;
}

// ── Event Enrichment ──────────────────────────────────────────────

export interface EnrichedEvent extends MonitorEvent {
  _file_path?: string;
  _tier: 1 | 2 | 3 | 4;
  _is_error?: boolean;
}

export function enrichEvent(event: MonitorEvent): EnrichedEvent {
  const enriched = event as EnrichedEvent;
  enriched._tier = getEventTier(event.hook_event_name);
  enriched._is_error = isErrorEvent(event);

  // Extract file_path from tool_input
  const input = event.tool_input || {};
  if (input.file_path) {
    enriched._file_path = input.file_path as string;
  } else if (event.file_path) {
    enriched._file_path = event.file_path;
  }

  return enriched;
}

// ── At-Rest Encryption ───────────────────────────────────────────
// Non-exportable AES-256-GCM key stored in IndexedDB config store.
// Plaintext index fields coexist with encrypted payload blob.

let cachedDeviceKey: CryptoKey | null = null;

async function getDeviceKey(db: IDBDatabase): Promise<CryptoKey> {
  if (cachedDeviceKey) return cachedDeviceKey;

  // Try to load existing key
  const existing = await new Promise<CryptoKey | null>((resolve) => {
    const tx = db.transaction("config", "readonly");
    const request = tx.objectStore("config").get("device_key");
    request.onsuccess = () => {
      const record = request.result;
      resolve(record?.value ?? null);
    };
    request.onerror = () => resolve(null);
  });

  if (existing) {
    cachedDeviceKey = existing;
    return existing;
  }

  // Generate new non-exportable key
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false, // non-exportable
    ["encrypt", "decrypt"],
  );

  // Store in config
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("config", "readwrite");
    tx.objectStore("config").put({ key: "device_key", value: key });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  cachedDeviceKey = key;
  return key;
}

async function encryptPayload(data: Record<string, unknown>, key: CryptoKey): Promise<{ _encrypted_payload: ArrayBuffer; _iv: ArrayBuffer }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
  return { _encrypted_payload: ciphertext, _iv: iv.buffer };
}

async function decryptPayload(encrypted: ArrayBuffer, iv: ArrayBuffer, key: CryptoKey): Promise<Record<string, unknown>> {
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, encrypted);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

// Plaintext fields kept for event indexing
const EVENT_INDEX_FIELDS = [
  "session_id", "timestamp", "hook_event_name", "_file_path",
  "tool_use_id", "project_path", "_tier", "_is_error", "tool_name",
] as const;

// Plaintext fields kept for session indexing
const SESSION_INDEX_FIELDS = [
  "session_id", "last_event_at", "project_path",
] as const;

interface EncryptedRecord {
  _encrypted_payload: ArrayBuffer;
  _iv: ArrayBuffer;
  [key: string]: unknown;
}

function isEncrypted(record: unknown): record is EncryptedRecord {
  return !!record && typeof record === "object" && "_encrypted_payload" in record;
}

async function decryptEventRecord(record: unknown, key: CryptoKey): Promise<EnrichedEvent> {
  if (!isEncrypted(record)) return record as EnrichedEvent; // plaintext (pre-encryption data)
  try {
    const decrypted = await decryptPayload(record._encrypted_payload, record._iv, key);
    return decrypted as unknown as EnrichedEvent;
  } catch {
    // Key loss or corruption — return what we can from plaintext index fields
    console.warn("ClaudeMon: failed to decrypt event record, returning index fields only");
    const partial: Record<string, unknown> = {};
    for (const f of EVENT_INDEX_FIELDS) {
      if (f in (record as Record<string, unknown>)) partial[f] = (record as Record<string, unknown>)[f];
    }
    return partial as unknown as EnrichedEvent;
  }
}

async function decryptSessionRecord(record: unknown, key: CryptoKey): Promise<SessionState> {
  if (!isEncrypted(record)) return record as SessionState;
  try {
    const decrypted = await decryptPayload(record._encrypted_payload, record._iv, key);
    return decrypted as unknown as SessionState;
  } catch {
    console.warn("ClaudeMon: failed to decrypt session record, returning index fields only");
    const partial: Record<string, unknown> = {};
    for (const f of SESSION_INDEX_FIELDS) {
      if (f in (record as Record<string, unknown>)) partial[f] = (record as Record<string, unknown>)[f];
    }
    return partial as unknown as SessionState;
  }
}

// ── IndexedDB Operations ──────────────────────────────────────────

let dbInstance: IDBDatabase | null = null;
let pruneTimer: ReturnType<typeof setInterval> | null = null;

export function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return Promise.resolve(dbInstance);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      // Sessions store
      if (!db.objectStoreNames.contains("sessions")) {
        const sessions = db.createObjectStore("sessions", { keyPath: "session_id" });
        sessions.createIndex("last_event_at", "last_event_at", { unique: false });
        sessions.createIndex("project_path", "project_path", { unique: false });
      }

      // Events store
      if (!db.objectStoreNames.contains("events")) {
        const events = db.createObjectStore("events", { autoIncrement: true });
        events.createIndex("session_timestamp", ["session_id", "timestamp"], { unique: false });
        events.createIndex("timestamp", "timestamp", { unique: false });
        events.createIndex("_file_path", "_file_path", { unique: false });
        events.createIndex("file_timestamp", ["_file_path", "timestamp"], { unique: false });
        events.createIndex("project_hook", ["project_path", "hook_event_name"], { unique: false });
        events.createIndex("tool_use_id", "tool_use_id", { unique: false });
      }

      // Config store
      if (!db.objectStoreNames.contains("config")) {
        db.createObjectStore("config", { keyPath: "key" });
      }
    };

    request.onsuccess = () => {
      dbInstance = request.result;

      // Start auto-prune timer
      if (!pruneTimer) {
        pruneTimer = setInterval(() => pruneOld().catch(() => {}), PRUNE_INTERVAL_MS);
        // Run initial prune
        pruneOld().catch(() => {});
      }

      resolve(dbInstance);
    };

    request.onerror = () => reject(request.error);
  });
}

// ── Session CRUD ──────────────────────────────────────────────────

export async function saveSession(session: SessionState): Promise<void> {
  const db = await openDB();
  const key = await getDeviceKey(db);

  // Store session without the events array (too large)
  const { events, ...meta } = session;

  // Extract plaintext index fields, encrypt everything else
  const plaintext: Record<string, unknown> = {};
  for (const f of SESSION_INDEX_FIELDS) {
    if (f in meta) plaintext[f] = (meta as Record<string, unknown>)[f];
  }

  const encrypted = await encryptPayload(meta as Record<string, unknown>, key);

  return new Promise((resolve, reject) => {
    const tx = db.transaction("sessions", "readwrite");
    tx.objectStore("sessions").put({ ...plaintext, ...encrypted });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadSessions(): Promise<SessionState[]> {
  const db = await openDB();
  const key = await getDeviceKey(db);

  const records = await new Promise<unknown[]>((resolve, reject) => {
    const tx = db.transaction("sessions", "readonly");
    const request = tx.objectStore("sessions").getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });

  const sessions = await Promise.all(records.map((r) => decryptSessionRecord(r, key)));
  return sessions.map((s) => ({
    ...s,
    events: s.events || [],
    subagents: s.subagents || [],
    files_touched: s.files_touched || [],
    commands_run: s.commands_run || [],
  }));
}

// ── Event CRUD ────────────────────────────────────────────────────

async function encryptEventForStorage(event: MonitorEvent, key: CryptoKey): Promise<Record<string, unknown>> {
  const enriched = enrichEvent(event);

  // Extract plaintext index fields
  const plaintext: Record<string, unknown> = {};
  for (const f of EVENT_INDEX_FIELDS) {
    if (f in enriched) plaintext[f] = (enriched as unknown as Record<string, unknown>)[f];
  }

  // Encrypt full event
  const encrypted = await encryptPayload(enriched as unknown as Record<string, unknown>, key);
  return { ...plaintext, ...encrypted };
}

export async function saveEvent(event: MonitorEvent): Promise<void> {
  const db = await openDB();
  const key = await getDeviceKey(db);
  const record = await encryptEventForStorage(event, key);

  return new Promise((resolve, reject) => {
    const tx = db.transaction("events", "readwrite");
    tx.objectStore("events").add(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveBatch(events: MonitorEvent[]): Promise<void> {
  if (events.length === 0) return;
  const db = await openDB();
  const key = await getDeviceKey(db);
  const records = await Promise.all(events.map((e) => encryptEventForStorage(e, key)));

  return new Promise((resolve, reject) => {
    const tx = db.transaction("events", "readwrite");
    const store = tx.objectStore("events");
    for (const record of records) {
      store.add(record);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadEvents(sessionId: string): Promise<EnrichedEvent[]> {
  const db = await openDB();
  const key = await getDeviceKey(db);

  const records = await new Promise<unknown[]>((resolve, reject) => {
    const tx = db.transaction("events", "readonly");
    const index = tx.objectStore("events").index("session_timestamp");
    const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Number.POSITIVE_INFINITY]);
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });

  return Promise.all(records.map((r) => decryptEventRecord(r, key)));
}

// ── Cross-Session Queries ─────────────────────────────────────────

export async function queryByFile(filePath: string): Promise<EnrichedEvent[]> {
  const db = await openDB();
  const key = await getDeviceKey(db);

  const records = await new Promise<unknown[]>((resolve, reject) => {
    const tx = db.transaction("events", "readonly");
    const index = tx.objectStore("events").index("_file_path");
    const request = index.getAll(filePath);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });

  return Promise.all(records.map((r) => decryptEventRecord(r, key)));
}

/** Find all writes to a file BEFORE a given timestamp (cross-session mutation history) */
export async function queryWritesBefore(filePath: string, beforeTimestamp: number): Promise<EnrichedEvent[]> {
  const db = await openDB();
  const key = await getDeviceKey(db);

  // Collect candidate records using cursor (tool_name is plaintext)
  const records = await new Promise<unknown[]>((resolve, reject) => {
    const tx = db.transaction("events", "readonly");
    const index = tx.objectStore("events").index("file_timestamp");
    const range = IDBKeyRange.bound([filePath, 0], [filePath, beforeTimestamp], false, true);
    const results: unknown[] = [];
    const request = index.openCursor(range, "prev"); // newest first
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || results.length >= 10) {
        resolve(results);
        return;
      }
      const record = cursor.value as Record<string, unknown>;
      // tool_name is plaintext — filter for mutations before decrypting
      if (record.tool_name === "Edit" || record.tool_name === "Write") {
        results.push(record);
      }
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });

  return Promise.all(records.map((r) => decryptEventRecord(r, key)));
}

export async function queryErrors(projectPath: string): Promise<EnrichedEvent[]> {
  const db = await openDB();
  const key = await getDeviceKey(db);

  const records = await new Promise<unknown[]>((resolve, reject) => {
    const tx = db.transaction("events", "readonly");
    const results: unknown[] = [];

    // Query PostToolUseFailure events for this project
    const index = tx.objectStore("events").index("project_hook");
    const req1 = index.openCursor(IDBKeyRange.only([projectPath, "PostToolUseFailure"]));
    req1.onsuccess = () => {
      const cursor = req1.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      }
    };

    // Also get StopFailure
    const req2 = index.openCursor(IDBKeyRange.only([projectPath, "StopFailure"]));
    req2.onsuccess = () => {
      const cursor = req2.result;
      if (cursor) {
        results.push(cursor.value);
        cursor.continue();
      }
    };

    tx.oncomplete = () => resolve(results);
    tx.onerror = () => reject(tx.error);
  });

  const decrypted = await Promise.all(records.map((r) => decryptEventRecord(r, key)));
  return decrypted.sort((a, b) => a.timestamp - b.timestamp);
}

// ── Pruning ───────────────────────────────────────────────────────

export async function pruneOld(): Promise<{ sessions: number; events: number }> {
  const db = await openDB();
  const now = Date.now();
  const normalCutoff = now - NORMAL_RETENTION_MS;
  const errorCutoff = now - ERROR_RETENTION_MS;
  let eventsPruned = 0;
  let sessionsPruned = 0;

  // Prune events — _is_error is plaintext, no decryption needed
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("events", "readwrite");
    const store = tx.objectStore("events");
    const index = store.index("timestamp");
    const range = IDBKeyRange.upperBound(errorCutoff); // oldest possible events

    const request = index.openCursor(range);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const record = cursor.value as Record<string, unknown>;
      // _is_error is a plaintext index field
      const cutoff = record._is_error ? errorCutoff : normalCutoff;
      if ((record.timestamp as number) < cutoff) {
        cursor.delete();
        eventsPruned++;
      }
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  // Prune sessions with no recent activity
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("sessions", "readwrite");
    const store = tx.objectStore("sessions");
    const index = store.index("last_event_at");
    const range = IDBKeyRange.upperBound(normalCutoff);

    const request = index.openCursor(range);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      cursor.delete();
      sessionsPruned++;
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return { sessions: sessionsPruned, events: eventsPruned };
}

// ── Storage Estimate ──────────────────────────────────────────────

export async function getStorageEstimate(): Promise<{ used: number; quota: number }> {
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate();
    return { used: est.usage || 0, quota: est.quota || 0 };
  }
  return { used: 0, quota: 0 };
}

// ── Encryption Health ────────────────────────────────────────────

export async function isEncryptionHealthy(): Promise<boolean> {
  try {
    const db = await openDB();
    await getDeviceKey(db);
    return true;
  } catch {
    return false;
  }
}

// ── Clear All ─────────────────────────────────────────────────────

export async function clearAll(): Promise<void> {
  const db = await openDB();
  cachedDeviceKey = null; // force key regeneration on next use
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["sessions", "events", "config"], "readwrite");
    tx.objectStore("sessions").clear();
    tx.objectStore("events").clear();
    tx.objectStore("config").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
