import { createSignal } from "solid-js";
import { createStore, produce, reconcile } from "solid-js/store";
import type { MonitorEvent, SessionState, WsMessage } from "../../../../packages/types/monitor";
import { TOOL_CATEGORIES } from "../../../../packages/types/monitor";
import { createWebSocket } from "./websocket";
import { formatDuration } from "../utils/time";
import { openDB, saveSession, saveEvent, loadSessions, pruneOld } from "./persistence";
import { decryptTransit, getTransitKey } from "../crypto/transit";
import { normalizeEvent } from "../utils/normalize";

const MAX_EVENTS = 100;

// ── Smart Status ──────────────────────────────────────────────────

function toolTarget(event: MonitorEvent): string {
  const input = event.tool_input || {};
  const name = event.tool_name || "";
  if (name === "Bash") {
    const cmd = (input.command as string) || "";
    return cmd.length > 50 ? cmd.slice(0, 47) + "..." : cmd;
  }
  if (name === "Edit" || name === "Write" || name === "Read" || name === "NotebookEdit") {
    const fp = (input.file_path as string) || "";
    return fp.split("/").slice(-2).join("/");
  }
  if (name === "Grep") return (input.pattern as string)?.slice(0, 40) || "";
  if (name === "Glob") return (input.pattern as string)?.slice(0, 40) || "";
  if (name === "Agent") return (input.description as string)?.slice(0, 40) || "";
  return "";
}

function computeSmartStatus(session: SessionState, event: MonitorEvent): string {
  const name = event.hook_event_name;

  if (name === "PermissionRequest") {
    const tool = event.tool_name || "tool";
    const target = toolTarget(event);
    return target ? `Permission: ${tool} \`${target}\`` : `Permission: ${tool}`;
  }
  if (name === "Notification") {
    const msg = event.notification_message || "";
    if (/plan/i.test(msg)) return "Plan ready for approval";
    return msg ? `Needs input: ${msg.slice(0, 60)}` : "Needs your input";
  }
  if (name === "Elicitation") return "Answering a question...";
  if (name === "StopFailure") {
    const err = event.error || event.error_details || "";
    return err ? `Crashed: ${err.slice(0, 80)}` : "Crashed";
  }
  if (name === "PostToolUseFailure") {
    const tool = event.tool_name || "tool";
    const target = toolTarget(event);
    return target ? `Error: ${tool} \`${target}\`` : `Error: ${tool} failed`;
  }
  if (name === "Stop") {
    const dur = formatDuration(session.started_at);
    const parts: string[] = [];
    if (session.edit_count) parts.push(`${session.edit_count}e`);
    if (session.command_count) parts.push(`${session.command_count}c`);
    if (session.read_count) parts.push(`${session.read_count}r`);
    const counters = parts.length > 0 ? ` — ${parts.join(" ")}` : "";
    const prompt = session.last_prompt ? ` \`${session.last_prompt.slice(0, 40)}\`` : "";
    return `Done (${dur})${counters}${prompt}`;
  }
  if (name === "SessionEnd") {
    const reason = event.end_reason || "session ended";
    return `Ended: ${reason}`;
  }
  if (name === "UserPromptSubmit") {
    const prompt = event.prompt?.slice(0, 60) || "";
    return prompt ? `Working on: \`${prompt}\`` : "Working...";
  }
  if (name === "PreToolUse") {
    const tool = event.tool_name || "tool";
    const target = toolTarget(event);
    return target ? `Running ${tool} on ${target}` : `Running ${tool}`;
  }
  if (name === "PostToolUse") {
    return "Thinking...";
  }
  if (name === "PostCompact") {
    return `Context compacted (#${session.compaction_count || 1})`;
  }
  if (name === "PreCompact") return "Compacting context...";
  if (name === "PermissionDenied") {
    const reason = event.permission_denied_reason || "";
    return reason ? `Denied: ${reason.slice(0, 60)}` : "Permission denied";
  }
  if (name === "SessionStart") {
    return "Session started";
  }
  if (name === "CwdChanged") return session.smart_status || "Working...";
  if (name === "FileChanged") return session.smart_status || "Working...";
  if (name === "Setup") return "Initializing...";
  if (name === "WorktreeCreate") {
    const wt = (event as any).worktree_name || "";
    return wt ? `Worktree created: ${wt}` : "Worktree created";
  }
  if (name === "WorktreeRemove") {
    const wt = (event as any).worktree_name || "";
    return wt ? `Worktree removed: ${wt}` : "Worktree removed";
  }
  if (name === "TaskCreated") {
    const subj = event.task_subject?.slice(0, 40) || "";
    return subj ? `Task: ${subj}` : "Task created";
  }
  if (name === "TaskCompleted") {
    const subj = event.task_subject?.slice(0, 40) || "";
    return subj ? `Task done: ${subj}` : "Task completed";
  }

  // Fallback: keep previous smart_status or generic
  return session.smart_status || "Working...";
}

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

        // Ring buffer
        session.events.push(event);
        if (session.events.length > MAX_EVENTS) {
          session.events = session.events.slice(-MAX_EVENTS);
        }
      }),
    );

    // Persist to IndexedDB (fire-and-forget, non-blocking)
    const sessionCopy = sessions[sid];
    if (sessionCopy) {
      saveSession(sessionCopy).catch(() => {});
      saveEvent(event).catch(() => {});
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
      case "ping":
        break;
    }
  }

  const { status, send } = createWebSocket(handleMessage);

  function respondToAction(actionId: string, hookResponse: Record<string, unknown>) {
    send({ type: "action_response", action_id: actionId, hook_response: hookResponse });
    // Optimistically remove from store (server will also send action_resolved)
    setPendingActions(actionId, undefined!);
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

  return { sessions, connectionStatus: status, persistenceReady, pendingActions, respondToAction };
}
