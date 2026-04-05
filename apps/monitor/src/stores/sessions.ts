import { createStore, produce } from "solid-js/store";
import type { MonitorEvent, SessionState, WsMessage } from "../../../../packages/types/monitor";
import { TOOL_CATEGORIES } from "../../../../packages/types/monitor";
import { createWebSocket } from "./websocket";

const MAX_EVENTS = 100;

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
    files_touched: [],
    commands_run: [],
    events: [],
    subagents: [],
    source: "local",
  };
}

export function createSessionStore() {
  const [sessions, setSessions] = createStore<Record<string, SessionState>>({});

  function handleEvent(event: MonitorEvent) {
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
          case "TaskCreated":
          case "TaskCompleted":
          case "TeammateIdle":
          case "ConfigChange":
          case "WorktreeCreate":
          case "WorktreeRemove":
          case "InstructionsLoaded":
          case "Elicitation":
          case "ElicitationResult":
          case "Setup":
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

        // Ring buffer
        session.events.push(event);
        if (session.events.length > MAX_EVENTS) {
          session.events = session.events.slice(-MAX_EVENTS);
        }
      }),
    );
  }

  function handleMessage(msg: WsMessage) {
    switch (msg.type) {
      case "event":
        handleEvent(msg.event);
        break;
      case "sessions_snapshot":
        setSessions(
          produce((state) => {
            // Clear and replace
            for (const key of Object.keys(state)) delete state[key];
            for (const s of msg.sessions) state[s.session_id] = s;
          }),
        );
        break;
      case "session_update":
        setSessions(msg.session.session_id, msg.session);
        break;
      case "ping":
        break;
    }
  }

  const { status } = createWebSocket(handleMessage);

  return { sessions, connectionStatus: status };
}
