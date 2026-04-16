import { createMemo, createSignal } from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";
import type { ChannelMessage, MonitorEvent, SessionState, WsMessage } from "../../../../packages/types/monitor";
import { TOOL_CATEGORIES } from "../../../../packages/types/monitor";
import { createWebSocket } from "./websocket";
import { computeSmartStatus } from "../utils/session-status";
import { getMonitorToolInfo } from "../utils/monitor";
import { openDB, saveSession, saveEvent, loadSessions, loadEvents, pruneOld } from "./persistence";
import { decryptTransit, getTransitKey } from "../crypto/transit";
import { normalizeEvent } from "../utils/normalize";

// ── Canvas key helper ──────────────────────────────────────────────
// Sessions are ephemeral (new ID each launch). Positions are keyed by
// project_name/branch so canvas layout persists across sessions, machines,
// and repo relocations.
export function canvasKey(session: SessionState): string {
  return `${session.project_name}/${session.branch || "main"}`;
}

const MAX_EVENTS = 100;
const MAX_EVENTS_WITH_HISTORY = 5000;

function createSessionFromEvent(event: MonitorEvent): SessionState {
  return {
    session_id: event.session_id,
    machine_id: event.machine_id,
    project_name: event.project_path.split("/").pop() || "unknown",
    project_path: event.project_path,
    branch: event.branch,
    model: event.model,
    status: "thinking",
    started_at: event.timestamp,
    last_event_at: event.timestamp,
    edit_count: 0,
    command_count: 0,
    read_count: 0,
    search_count: 0,
    error_count: 0,
    compaction_count: 0,
    permission_denied_count: 0,
    task_count: 0,
    instructions_loaded_count: 0,
    monitor_launch_count: 0,
    files_touched: [],
    commands_run: [],
    events: [],
    subagents: [],
    source: "local",
  };
}

export function createSessionStore() {
  const [sessions, setSessions] = createStore<Record<string, SessionState>>({});
  const [pendingActions, setPendingActions] = createStore<
    Record<string, { id: string; session_id: string; hook_event_name: string; event_data: Record<string, unknown> }>
  >({});

  // History loading state — tracks which sessions are loading / have loaded IDB events
  const [historyLoading, setHistoryLoading] = createSignal<Set<string>>(new Set());
  const historyLoadedSet = new Set<string>();

  // ── File index: O(1) cross-session edge detection ──
  // file_path → Set<session_id> of sessions that have touched that file.
  // Used by the canvas to draw file-conflict and shared-file edges without scanning.
  const [fileIndex, setFileIndex] = createSignal<Map<string, Set<string>>>(new Map(), { equals: false });

  function updateFileIndex(sessionId: string, filePath: string | undefined) {
    if (!filePath) return;
    const idx = fileIndex();
    if (!idx.has(filePath)) idx.set(filePath, new Set());
    idx.get(filePath)!.add(sessionId);
    setFileIndex(idx); // trigger memoized edge consumers
  }

  // ── Time-travel scrubber ──
  // null = LIVE (default). Otherwise: cap all derived state to events ≤ this timestamp.
  const [scrubberTime, setScrubberTime] = createSignal<number | null>(null);

  // Live event dedup — prevents the same event from being added twice
  // (e.g., from duplicate hooks, WebSocket reconnect replays, or hook retries)
  const seenEventKeys = new Map<string, Set<string>>(); // session_id → Set<eventKey>

  function liveEventKey(e: MonitorEvent): string {
    if (e.tool_use_id) return `tuid:${e.tool_use_id}:${e.hook_event_name}`;
    return `${e.timestamp}:${e.hook_event_name}:${e.tool_name || ""}`;
  }

  function handleEvent(event: MonitorEvent) {
    // Decrypt transit-encrypted events before processing
    if (event._encrypted) {
      const key = getTransitKey();
      if (key) {
        decryptTransit(event._encrypted, key)
          .then((decrypted) => {
            const merged = { ...event, ...decrypted } as MonitorEvent;
            delete merged._encrypted;
            handleEvent(merged); // re-process with decrypted fields
          })
          .catch(() => {
            event._decrypt_failed = true;
            // Continue processing with plaintext fields only
          });
        if (!event._decrypt_failed) return; // async decrypt in progress
      }
    }

    // Normalize CC-native field names → ClaudeMon namespaced fields
    normalizeEvent(event);

    const sid = event.session_id;

    setSessions(
      produce((state) => {
        if (!state[sid]) {
          state[sid] = createSessionFromEvent(event);
        }

        const session = state[sid];

        // Dedup: skip if we've already seen this exact event
        const key = liveEventKey(event);
        if (!seenEventKeys.has(sid)) seenEventKeys.set(sid, new Set());
        const seen = seenEventKeys.get(sid)!;
        if (seen.has(key)) return; // duplicate — skip entirely
        seen.add(key);
        if (seen.size > 500) {
          const keys = [...seen];
          seen.clear();
          for (const k of keys.slice(-300)) seen.add(k);
        }

        session.last_event_at = event.timestamp;
        if (event.model) session.model = event.model;
        if (event.branch) {
          session.branch = event.branch;
        }

        // Status derivation
        switch (event.hook_event_name) {
          case "PreToolUse":
            session.status = "working";
            break;
          case "PostToolUse":
          case "PostToolUseFailure":
            session.status = "thinking";
            if (event.tool_name) {
              if (TOOL_CATEGORIES.edits.has(event.tool_name)) session.edit_count++;
              if (TOOL_CATEGORIES.commands.has(event.tool_name)) session.command_count++;
              if (TOOL_CATEGORIES.reads.has(event.tool_name)) session.read_count++;
              if (TOOL_CATEGORIES.searches.has(event.tool_name)) session.search_count++;
            }
            break;
          case "Notification":
            session.status = "waiting";
            break;
          case "Stop":
            session.status = "done";
            break;
          case "StopFailure":
            session.status = "error";
            break;
          case "SessionEnd":
            session.status = "offline";
            break;
          case "SessionStart":
            session.status = "thinking";
            session.edit_count = 0;
            session.command_count = 0;
            session.read_count = 0;
            session.search_count = 0;
            session.error_count = 0;
            session.compaction_count = 0;
            session.permission_denied_count = 0;
            session.files_touched = [];
            session.commands_run = [];
            session.tool_rate = undefined;
            session.error_rate = undefined;
            session.notification_message = undefined;
            session.end_reason = undefined;
            session.compact_summary = undefined;
            session.last_prompt = undefined;
            session.config_source = undefined;
            session.task_count = 0;
            session.instructions_loaded_count = 0;
            session.monitor_launch_count = 0;
            session.last_monitor_description = undefined;
            session.last_monitor_command = undefined;
            session.last_monitor_persistent = undefined;
            session.last_monitor_timeout_ms = undefined;
            session.last_monitor_started_at = undefined;
            session.events = [];
            session.started_at = event.timestamp;
            break;
          case "PreCompact":
            session.status = "working";
            break;
          case "PostCompact":
            session.status = "thinking";
            session.compaction_count = (session.compaction_count || 0) + 1;
            if (event.compact_summary) {
              session.compact_summary = event.compact_summary;
            }
            break;
          case "UserPromptSubmit":
            session.status = "working";
            if (event.prompt) session.last_prompt = event.prompt.slice(0, 80);
            break;
          case "PermissionRequest":
            session.status = "waiting";
            break;
          case "PermissionDenied":
            session.permission_denied_count = (session.permission_denied_count || 0) + 1;
            break;
          case "CwdChanged":
            if (event.new_cwd) session.cwd = event.new_cwd;
            break;
          case "FileChanged":
            if (event.file_path) {
              const fp = event.file_path;
              if (!session.files_touched?.includes(fp)) {
                session.files_touched = [...(session.files_touched || []), fp];
              }
              updateFileIndex(sid, fp);
            }
            break;
          case "ConfigChange":
            if (event.config_source) session.config_source = event.config_source;
            break;
          case "WorktreeCreate":
            session.worktree_count = (session.worktree_count || 0) + 1;
            break;
          case "WorktreeRemove":
            session.worktree_count = Math.max(0, (session.worktree_count || 1) - 1);
            break;
          case "Elicitation":
            session.status = "waiting";
            break;
          case "ElicitationResult":
            session.status = "working";
            break;
          case "Setup":
            session.status = "thinking";
            if (event.model) session.model = event.model;
            if (event.permission_mode) session.permission_mode = event.permission_mode;
            break;
          case "InstructionsLoaded":
            session.instructions_loaded_count = (session.instructions_loaded_count || 0) + 1;
            break;
          case "TaskCreated":
            session.task_count = (session.task_count || 0) + 1;
            break;
          case "TaskCompleted":
          case "TeammateIdle":
            break;
        }

        // Notification message extraction
        if (event.hook_event_name === "Notification") {
          if (event.notification_message) session.notification_message = event.notification_message;
        }

        // End reason
        if (event.hook_event_name === "SessionEnd") {
          if (event.end_reason) session.end_reason = event.end_reason;
        }

        // Monitor tool presence — best-effort derivation from successful PostToolUse.
        // PostToolUseFailure for Monitor is intentionally ignored: we don't fake a
        // watch that never actually started. Stop/SessionEnd clear the "actively
        // watching" signal since we don't receive a reliable monitor-stopped event.
        if (event.hook_event_name === "PostToolUse" && event.tool_name === "Monitor") {
          const monitor = getMonitorToolInfo(event.tool_input);
          session.monitor_launch_count = (session.monitor_launch_count || 0) + 1;
          session.last_monitor_description = monitor.description;
          session.last_monitor_command = monitor.command;
          session.last_monitor_persistent = monitor.persistent;
          session.last_monitor_timeout_ms = monitor.timeoutMs;
          session.last_monitor_started_at = event.timestamp;
        }
        if (event.hook_event_name === "Stop" || event.hook_event_name === "SessionEnd") {
          session.last_monitor_started_at = undefined;
        }

        // Track files touched
        if (
          event.tool_name &&
          (event.tool_name === "Edit" || event.tool_name === "Write") &&
          event.tool_input?.file_path
        ) {
          const fp = event.tool_input.file_path as string;
          if (!session.files_touched?.includes(fp)) {
            session.files_touched = [...(session.files_touched || []), fp];
          }
          updateFileIndex(sid, fp);
        }

        // Track bash commands
        if (event.tool_name === "Bash" && event.tool_input?.command) {
          const cmds = [...(session.commands_run || []), (event.tool_input.command as string).slice(0, 100)];
          session.commands_run = cmds.slice(-20);
        }

        // Error tracking
        if (event.hook_event_name === "PostToolUseFailure") {
          session.error_count = (session.error_count || 0) + 1;
        }

        // Derived rates
        const elapsed = (event.timestamp - session.started_at) / 60000;
        if (elapsed > 0) {
          const totalTools = session.edit_count + session.command_count + session.read_count + session.search_count;
          session.tool_rate = Math.round((totalTools / elapsed) * 10) / 10;
          session.error_rate = totalTools > 0 ? Math.round((session.error_count / totalTools) * 100) / 100 : 0;
        }

        // Browser push notification for waiting state
        if (session.status === "waiting" && event.hook_event_name === "Notification") {
          if (
            typeof Notification !== "undefined" &&
            Notification.permission === "granted" &&
            localStorage.getItem("claudemon_notifications") === "on"
          ) {
            new Notification("ClaudeMon", {
              body: event.notification_message || `${session.project_name} is waiting for input`,
              tag: session.session_id,
            });
          }
        }

        // Smart status
        session.smart_status = computeSmartStatus(session, event);

        // Ring buffer — higher cap for sessions with IDB history loaded
        session.events.push(event);
        const cap = historyLoadedSet.has(sid) ? MAX_EVENTS_WITH_HISTORY : MAX_EVENTS;
        if (session.events.length > cap) {
          session.events = session.events.slice(-cap);
        }
      }),
    );

    // Persist to IndexedDB (fire-and-forget, non-blocking)
    const sessionCopy = sessions[sid];
    if (sessionCopy) {
      saveSession(sessionCopy).catch((err) => console.warn("ClaudeMon: session persist failed", err));
      saveEvent(event).catch((err) => console.warn("ClaudeMon: event persist failed", err));
    }
  }

  function handleMessage(msg: WsMessage) {
    switch (msg.type) {
      case "event":
        handleEvent(msg.event);
        break;
      case "sessions_snapshot": {
        // Build new state object and use reconcile for proper reactivity
        const newState: Record<string, SessionState> = {};
        for (const s of msg.sessions) {
          // Ensure arrays exist (server strips them via toMetadata)
          if (!s.events) s.events = [];
          if (!s.subagents) s.subagents = [];
          if (!s.files_touched) s.files_touched = [];
          if (!s.commands_run) s.commands_run = [];
          newState[s.session_id] = s;
        }
        setSessions(reconcile(newState));
        break;
      }
      case "session_update":
        setSessions(msg.session.session_id, msg.session);
        break;
      case "action_request":
        setPendingActions(msg.action.id, msg.action);
        break;
      case "action_resolved":
        setPendingActions(msg.action_id, undefined!);
        break;
      case "channel_message":
        appendChannelMessage(msg.session_id, {
          id: crypto.randomUUID(),
          session_id: msg.session_id,
          content: msg.content,
          user: msg.user,
          source: msg.source,
          direction: "in",
          timestamp: Date.now(),
        });
        break;
      case "channel_reply":
        appendChannelMessage(msg.session_id, {
          id: crypto.randomUUID(),
          session_id: msg.session_id,
          content: msg.content,
          source: "claude",
          direction: "out",
          timestamp: Date.now(),
        });
        break;
      case "channel_status":
        setSessions(
          produce((state) => {
            const s = state[msg.session_id];
            if (s) s.channel_connected = msg.connected;
          }),
        );
        break;
      case "ping":
        break;
    }
  }

  function appendChannelMessage(sessionId: string, message: ChannelMessage) {
    setSessions(
      produce((state) => {
        const s = state[sessionId];
        if (!s) return;
        if (!s.messages) s.messages = [];
        s.messages.push(message);
        // Cap message history in-memory (IDB holds everything)
        if (s.messages.length > 200) {
          s.messages = s.messages.slice(-200);
        }
      }),
    );
  }

  const { status, send, reconnect } = createWebSocket(handleMessage);

  function respondToAction(actionId: string, hookResponse: Record<string, unknown>) {
    send({ type: "action_response", action_id: actionId, hook_response: hookResponse });
    // Optimistically remove from store (server will also send action_resolved)
    setPendingActions(actionId, undefined!);
  }

  // ── Channel: send a message from dashboard to a session ──
  function sendMessage(sessionId: string, content: string, opts?: { user?: string; source?: string }) {
    if (!content.trim()) return;
    send({
      type: "channel_message",
      session_id: sessionId,
      content,
      user: opts?.user || "dashboard",
      source: opts?.source || "dashboard",
    });
  }

  // ── Batch broadcast: send the same message to N sessions ──
  function broadcastMessage(sessionIds: string[], content: string, opts?: { source?: string }) {
    for (const sid of sessionIds) {
      sendMessage(sid, content, { source: opts?.source || "broadcast" });
    }
  }

  // Convenience wrappers: batch compact/clear
  function batchCompact(sessionIds: string[]) {
    broadcastMessage(sessionIds, "/compact");
  }
  function batchClear(sessionIds: string[]) {
    broadcastMessage(sessionIds, "/clear");
  }

  // ── Time-travel aware derived state ──
  // Cross-session chronological hive stream: all events from all sessions, time-ordered.
  const hiveStream = createMemo(() => {
    const t = scrubberTime();
    const all: MonitorEvent[] = [];
    for (const s of Object.values(sessions)) {
      for (const e of s.events) {
        if (t === null || e.timestamp <= t) all.push(e);
      }
    }
    return all.sort((a, b) => b.timestamp - a.timestamp);
  });

  // Canvas file-edge derivation — O(edges in index), reactive to fileIndex changes.
  // At scrubber=null, uses the full index. With time-travel, filters to events ≤ t.
  const fileEdges = createMemo(() => {
    const t = scrubberTime();
    const idx = fileIndex();
    type Edge = { from: string; to: string; file: string; type: "shared" | "conflict" };
    const edges: Edge[] = [];
    for (const [file, sids] of idx) {
      const alive = [...sids].filter((sid) => {
        const s = sessions[sid];
        if (!s || s.status === "offline") return false;
        if (t !== null && s.started_at > t) return false;
        return true;
      });
      if (alive.length < 2) continue;
      for (let i = 0; i < alive.length; i++) {
        for (let j = i + 1; j < alive.length; j++) {
          const a = alive[i];
          const b = alive[j];
          const aEdited = didSessionEditFile(a, file, t);
          const bEdited = didSessionEditFile(b, file, t);
          edges.push({
            from: a,
            to: b,
            file,
            type: aEdited && bEdited ? "conflict" : "shared",
          });
        }
      }
    }
    return edges;
  });

  function didSessionEditFile(sessionId: string, filePath: string, cap: number | null): boolean {
    const s = sessions[sessionId];
    if (!s) return false;
    for (const e of s.events) {
      if (cap !== null && e.timestamp > cap) continue;
      if (
        e.hook_event_name === "PostToolUse" &&
        (e.tool_name === "Edit" || e.tool_name === "Write" || e.tool_name === "NotebookEdit")
      ) {
        const fp = (e.tool_input as Record<string, unknown>)?.file_path;
        if (fp === filePath) return true;
      }
    }
    return false;
  }

  // Load persisted sessions from IndexedDB on init, auto-stale old ones
  const STALE_MS = 10 * 60 * 1000; // 10 minutes
  const PURGE_MS = 24 * 60 * 60 * 1000; // 24 hours — don't even show these
  const [persistenceReady, setPersistenceReady] = createSignal(false);
  openDB()
    .then(() => loadSessions())
    .then((saved) => {
      if (saved.length > 0) {
        const now = Date.now();
        const newState: Record<string, SessionState> = {};
        for (const s of saved) {
          const age = now - s.last_event_at;
          // Skip sessions with no events for 24h+ — they're dead
          if (age > PURGE_MS) continue;
          // Auto-mark stale sessions as offline
          if (age > STALE_MS && s.status !== "done" && s.status !== "offline") {
            s.status = "offline";
          }
          newState[s.session_id] = s;
        }
        setSessions(reconcile(newState));
      }
      setPersistenceReady(true);
      // Run IndexedDB prune cycle
      pruneOld().catch(() => {});
    })
    .catch(() => setPersistenceReady(true)); // proceed even if IDB fails

  // ── Lazy History Loading ───────────────────────────────────────
  // Load events from IndexedDB for a specific session (called when tab is opened).
  // Idempotent — skips if already loaded or currently loading.

  function eventKey(e: MonitorEvent): string {
    if (e.tool_use_id) return `tuid:${e.tool_use_id}:${e.hook_event_name}`;
    return `${e.timestamp}:${e.hook_event_name}:${e.tool_name || ""}`;
  }

  async function loadSessionHistory(sessionId: string): Promise<void> {
    if (historyLoadedSet.has(sessionId)) return;
    if (historyLoading().has(sessionId)) return;

    // Mark loading
    const loading = new Set(historyLoading());
    loading.add(sessionId);
    setHistoryLoading(new Set(loading));

    try {
      const idbEvents = await loadEvents(sessionId);
      if (idbEvents.length === 0) {
        historyLoadedSet.add(sessionId);
        return;
      }

      // Normalize all IDB events (idempotent — safe to call again)
      for (const ev of idbEvents) {
        normalizeEvent(ev as MonitorEvent);
      }

      setSessions(
        produce((state) => {
          const session = state[sessionId];
          if (!session) return;

          // Build dedup set from existing in-memory events
          const existingKeys = new Set<string>();
          for (const e of session.events) {
            existingKeys.add(eventKey(e));
          }

          // Filter IDB events to avoid duplicates
          const newEvents: MonitorEvent[] = [];
          for (const e of idbEvents) {
            const key = eventKey(e as MonitorEvent);
            if (!existingKeys.has(key)) {
              newEvents.push(e as MonitorEvent);
            }
          }

          // Merge: IDB events (historical) + existing (live), sorted by timestamp
          session.events = [...newEvents, ...session.events].sort((a, b) => a.timestamp - b.timestamp);

          // Apply higher cap
          if (session.events.length > MAX_EVENTS_WITH_HISTORY) {
            session.events = session.events.slice(-MAX_EVENTS_WITH_HISTORY);
          }
        }),
      );

      historyLoadedSet.add(sessionId);
    } catch (err) {
      console.warn("ClaudeMon: failed to load history for session", sessionId, err);
    } finally {
      const loading = new Set(historyLoading());
      loading.delete(sessionId);
      setHistoryLoading(new Set(loading));
    }
  }

  return {
    sessions,
    connectionStatus: status,
    persistenceReady,
    pendingActions,
    respondToAction,
    loadSessionHistory,
    historyLoading,
    reconnect,
    // v0.7: bidirectional channel
    sendMessage,
    broadcastMessage,
    batchCompact,
    batchClear,
    // v0.7: time-travel scrubber
    scrubberTime,
    setScrubberTime,
    // v0.7: derived state for canvas + hive stream
    hiveStream,
    fileEdges,
  };
}
