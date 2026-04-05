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
  | "UserPromptSubmit"
  | "PreCompact"
  | "PostCompact"
  | "PermissionRequest"
  | "PermissionDenied"
  | "TaskCreated"
  | "TaskCompleted"
  | "TeammateIdle"
  | "ConfigChange"
  | "WorktreeCreate"
  | "WorktreeRemove"
  | "CwdChanged"
  | "FileChanged"
  | "InstructionsLoaded"
  | "Elicitation"
  | "ElicitationResult"
  | "Setup";

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

  // Notification
  notification_message?: string;
  notification_title?: string;
  notification_type?: string;

  // Compact
  compact_trigger?: string; // manual | auto
  compact_summary?: string;
  custom_instructions?: string;

  // Permission
  permission_suggestions?: unknown[];
  permission_denied_reason?: string;

  // Task
  task_id?: string;
  task_subject?: string;
  task_description?: string;
  teammate_name?: string;
  team_name?: string;

  // CwdChanged
  old_cwd?: string;
  new_cwd?: string;

  // FileChanged
  file_path?: string;
  file_event?: string; // change | add | unlink

  // InstructionsLoaded
  instruction_file_path?: string;
  memory_type?: string;
  load_reason?: string;

  // SessionEnd
  end_reason?: string;

  // SessionStart
  is_interrupt?: boolean;

  // Config
  config_source?: string;
  config_file_path?: string;

  // Worktree
  worktree_name?: string;
  worktree_path?: string;

  // User prompt
  prompt?: string;

  // Transcript
  transcript_path?: string;

  // Branch (sent from hook)
  branch?: string;
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

  // Derived metrics
  error_count: number;
  compaction_count: number;
  tool_rate?: number; // tools/min
  error_rate?: number; // errors/total tools
  notification_message?: string; // last notification text
  end_reason?: string;
  compact_summary?: string; // last compaction summary
  permission_denied_count: number;
  files_touched: string[]; // unique file paths edited
  commands_run: string[]; // recent bash commands (last 20)

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

// All hook event names as a runtime array (single source of truth)
export const HOOK_EVENTS: HookEventName[] = [
  "PreToolUse", "PostToolUse", "PostToolUseFailure",
  "Stop", "StopFailure", "Notification",
  "SessionStart", "SessionEnd",
  "SubagentStart", "SubagentStop",
  "PreCompact", "PostCompact",
  "UserPromptSubmit",
  "PermissionRequest", "PermissionDenied",
  "TaskCreated", "TaskCompleted",
  "TeammateIdle", "CwdChanged", "FileChanged",
  "ConfigChange",
  "WorktreeCreate", "WorktreeRemove",
  "InstructionsLoaded",
  "Elicitation", "ElicitationResult",
  "Setup",
];

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
