import { createStore, produce } from "solid-js/store";
import type { MonitorEvent, SessionState, WsMessage } from "../../../../packages/types/monitor";
import { TOOL_CATEGORIES } from "../../../../packages/types/monitor";
import { createWebSocket, type ConnectionStatus } from "./websocket";
import { createSignal } from "solid-js";

const MAX_EVENTS = 100;

function createSessionFromEvent(event: MonitorEvent): SessionState {
  return {
    session_id: event.session_id,
    machine_id: event.machine_id,
    project_name: event.project_path.split("/").pop() || "unknown",
    project_path: event.project_path,
    branch: (event as Record<string, unknown>).branch as string | undefined,
    model: event.model,
    status: "thinking",
    started_at: event.timestamp,
    last_event_at: event.timestamp,
    edit_count: 0,
    command_count: 0,
    read_count: 0,
    search_count: 0,
    events: [],
    subagents: [],
    source: "local",
  };
}

export function createSessionStore() {
  const [sessions, setSessions] = createStore<Record<string, SessionState>>({});
  const [connectionStatus, setConnectionStatus] = createSignal<ConnectionStatus>("connecting");

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
        if ((event as Record<string, unknown>).branch) {
          session.branch = (event as Record<string, unknown>).branch as string;
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
            session.events = [];
            session.started_at = event.timestamp;
            break;
        }

        // Browser push notification for waiting state
        if (session.status === "waiting" && event.hook_event_name === "Notification") {
          if (typeof Notification !== "undefined" && Notification.permission === "granted" && localStorage.getItem("claudemon_notifications") === "on") {
            new Notification("ClaudeMon", {
              body: `${session.project_name} is waiting for input`,
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
