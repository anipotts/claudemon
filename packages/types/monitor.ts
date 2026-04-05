// ---------------------------------------------------------------------------
// ClaudeMon — Shared Types
// ---------------------------------------------------------------------------

export type HookEventName =
  | "SessionStart"
  | "SessionEnd"
  | "PreToolUse"
  | "PostToolUse"
  | "PostToolUseFailure"
  | "SubagentStart"
  | "SubagentStop"
  | "Stop"
  | "StopFailure"
  | "Notification"
  | "UserPromptSubmit";

export interface MonitorEvent {
  // Identity
  session_id: string;
  machine_id: string;
  project_path: string;

  // Event
  hook_event_name: HookEventName;
  timestamp: number; // ms epoch

  // Tool events
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: Record<string, unknown>;

  // Agent hierarchy
  agent_id?: string;
  agent_type?: string;
  parent_session_id?: string;

  // Session lifecycle
  source?: string; // startup | resume | clear | compact
  permission_mode?: string;
  model?: string;
  cwd?: string;

  // Stop events
  stop_hook_active?: boolean;
  last_assistant_message?: string;

  // Tool tracking
  tool_use_id?: string;

  // Error info
  error?: string;
  error_details?: string;
}

export type SessionStatus =
  | "working"
  | "thinking"
  | "waiting"
  | "done"
  | "error"
  | "offline";

export type SessionSource = "local" | "cloud" | "remote-control";

export interface SessionState {
  session_id: string;
  machine_id: string;
  project_name: string;
  project_path: string;
  branch?: string;
  model?: string;
  status: SessionStatus;
  started_at: number;
  last_event_at: number;

  permission_mode?: string;
  transcript_path?: string;
  cwd?: string;

  // Live counters
  edit_count: number;
  command_count: number;
  read_count: number;
  search_count: number;

  // Recent events (ring buffer, last N)
  events: MonitorEvent[];

  // Agent hierarchy
  parent_session_id?: string;
  agent_type?: string;
  subagents: SessionState[];

  source: SessionSource;
}

// WebSocket message types (server → client)
export type WsMessage =
  | { type: "event"; event: MonitorEvent }
  | { type: "session_update"; session: SessionState }
  | { type: "sessions_snapshot"; sessions: SessionState[] }
  | { type: "ping"; ts: number };

// Status derivation helpers
export const TOOL_CATEGORIES = {
  edits: new Set(["Edit", "Write", "NotebookEdit"]),
  commands: new Set(["Bash"]),
  reads: new Set(["Read"]),
  searches: new Set(["Grep", "Glob"]),
} as const;

export const STATUS_LABELS: Record<SessionStatus, string> = {
  working: "Working...",
  thinking: "Thinking...",
  waiting: "Waiting for you",
  done: "Done",
  error: "Error",
  offline: "Offline",
};

export const STATUS_COLORS: Record<SessionStatus, string> = {
  working: "#a3b18a",   // safe green
  thinking: "#7b9fbf",  // blue
  waiting: "#c9a96e",   // suspicious amber
  done: "#666",         // gray
  error: "#b85c4a",     // attack red
  offline: "#333",      // dark
};
