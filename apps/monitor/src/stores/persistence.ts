// ── IndexedDB Persistence Layer ─────────────────────────────────
// Local-first storage for ClaudeMon events and sessions.
// All data lives in the browser — server is a pure relay.

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
  // Store session without the events array (too large)
  const { events, ...meta } = session;
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sessions", "readwrite");
    tx.objectStore("sessions").put(meta);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadSessions(): Promise<SessionState[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("sessions", "readonly");
    const request = tx.objectStore("sessions").getAll();
    request.onsuccess = () => {
      const sessions = (request.result || []).map((s: SessionState) => ({
        ...s,
        events: s.events || [],
        subagents: s.subagents || [],
        files_touched: s.files_touched || [],
        commands_run: s.commands_run || [],
      }));
      resolve(sessions);
    };
    request.onerror = () => reject(request.error);
  });
}

// ── Event CRUD ────────────────────────────────────────────────────

export async function saveEvent(event: MonitorEvent): Promise<void> {
  const db = await openDB();
  const enriched = enrichEvent(event);
  return new Promise((resolve, reject) => {
    const tx = db.transaction("events", "readwrite");
    tx.objectStore("events").add(enriched);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveBatch(events: MonitorEvent[]): Promise<void> {
  if (events.length === 0) return;
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("events", "readwrite");
    const store = tx.objectStore("events");
    for (const event of events) {
      store.add(enrichEvent(event));
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadEvents(sessionId: string): Promise<EnrichedEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("events", "readonly");
    const index = tx.objectStore("events").index("session_timestamp");
    const range = IDBKeyRange.bound([sessionId, 0], [sessionId, Infinity]);
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// ── Cross-Session Queries ─────────────────────────────────────────

export async function queryByFile(filePath: string): Promise<EnrichedEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("events", "readonly");
    const index = tx.objectStore("events").index("_file_path");
    const request = index.getAll(filePath);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/** Find all writes to a file BEFORE a given timestamp (cross-session mutation history) */
export async function queryWritesBefore(filePath: string, beforeTimestamp: number): Promise<EnrichedEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("events", "readonly");
    const index = tx.objectStore("events").index("file_timestamp");
    const range = IDBKeyRange.bound([filePath, 0], [filePath, beforeTimestamp], false, true);
    const results: EnrichedEvent[] = [];
    const request = index.openCursor(range, "prev"); // newest first
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor || results.length >= 10) {
        resolve(results);
        return;
      }
      const event = cursor.value as EnrichedEvent;
      // Only collect Edit/Write events (mutations)
      if (event.tool_name === "Edit" || event.tool_name === "Write") {
        results.push(event);
      }
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

export async function queryErrors(projectPath: string): Promise<EnrichedEvent[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("events", "readonly");
    const results: EnrichedEvent[] = [];

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

    tx.oncomplete = () => resolve(results.sort((a, b) => a.timestamp - b.timestamp));
    tx.onerror = () => reject(tx.error);
  });
}

// ── Pruning ───────────────────────────────────────────────────────

export async function pruneOld(): Promise<{ sessions: number; events: number }> {
  const db = await openDB();
  const now = Date.now();
  const normalCutoff = now - NORMAL_RETENTION_MS;
  const errorCutoff = now - ERROR_RETENTION_MS;
  let eventsPruned = 0;
  let sessionsPruned = 0;

  // Prune events
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("events", "readwrite");
    const store = tx.objectStore("events");
    const index = store.index("timestamp");
    const range = IDBKeyRange.upperBound(errorCutoff); // oldest possible events

    const request = index.openCursor(range);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      const event = cursor.value as EnrichedEvent;
      // Error events: use error retention. Normal: use normal retention.
      const cutoff = event._is_error ? errorCutoff : normalCutoff;
      if (event.timestamp < cutoff) {
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

// ── Clear All ─────────────────────────────────────────────────────

export async function clearAll(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["sessions", "events"], "readwrite");
    tx.objectStore("sessions").clear();
    tx.objectStore("events").clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
