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
  duration_ms?: number; // PostToolUse: wall-clock time from PreToolUse to PostToolUse

  // Agent hierarchy
  agent_id?: string;
  agent_type?: string;
  parent_session_id?: string;
  agent_transcript_path?: string; // SubagentStop: local path to subagent transcript JSONL

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

  // E2E encryption envelope (transit)
  _encrypted?: EncryptedEnvelope;
  _decrypt_failed?: boolean;
}

// ── E2E Encryption ──────────────────────────────────────────────

export interface EncryptedEnvelope {
  v: 1;
  alg: "aes-256-gcm" | "aes-256-cbc-hmac";
  iv: string; // base64
  ct: string; // base64 ciphertext (JSON of all sensitive fields)
  tag?: string; // base64 GCM auth tag (GCM only)
  mac?: string; // hex HMAC-SHA256 (CBC fallback only)
}

export type SessionStatus = "working" | "thinking" | "waiting" | "done" | "error" | "offline";

export type SessionSource = "local" | "cloud" | "remote-control";

// ── Channel messages ────────────────────────────────────────────────────
// Bidirectional dashboard ↔ session communication via plugin/server.ts MCP channel.
export interface ChannelMessage {
  id: string; // uuid
  session_id: string;
  content: string;
  user?: string; // who sent it (dashboard user, iMessage sender, etc.)
  source?: string; // "dashboard" | "imessage" | "telegram" | etc.
  direction: "in" | "out"; // in = from dashboard to Claude, out = reply from Claude
  timestamp: number;
}

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
  session_source?: "startup" | "resume" | "clear" | "compact"; // from SessionStart event

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
  last_prompt?: string; // last UserPromptSubmit text (first 80 chars)
  compact_summary?: string; // last compaction summary
  permission_denied_count: number;
  // Monitor tool (Claude Code v2.1.98+) — best-effort presence derived from PreToolUse/PostToolUse
  monitor_launch_count?: number;
  last_monitor_description?: string;
  last_monitor_command?: string;
  last_monitor_persistent?: boolean;
  last_monitor_timeout_ms?: number;
  last_monitor_started_at?: number;
  files_touched: string[]; // unique file paths edited
  commands_run: string[]; // recent bash commands (last 20)

  // Consolidated event state
  config_source?: string; // from ConfigChange
  worktree_count?: number; // from WorktreeCreate/Remove
  task_count?: number; // from TaskCreated
  instructions_loaded_count?: number; // from InstructionsLoaded

  // Smart contextual status string (computed client-side)
  smart_status?: string;

  // Recent events (ring buffer, last N)
  events: MonitorEvent[];

  // Channel messages: dashboard ↔ Claude conversations via the MCP channel
  messages?: ChannelMessage[];

  // Channel connectivity: is the plugin/server.ts MCP server currently connected?
  channel_connected?: boolean;

  // Agent hierarchy
  parent_session_id?: string;
  agent_type?: string;
  subagents: SessionState[];

  source: SessionSource;
}

// ── Action Bridge ────────────────────────────────────────────────

export interface PendingAction {
  id: string;
  session_id: string;
  hook_event_name: string;
  event_data: Record<string, unknown>;
}

// WebSocket message types (server ↔ client)
// Browser ↔ DO: event broadcasts, action bridge, ping, channel messaging
// Channel MCP server ↔ DO: channel_identify on connect, channel_message (inbound), channel_reply (outbound)
export type WsMessage =
  | { type: "event"; event: MonitorEvent }
  | { type: "session_update"; session: SessionState }
  | { type: "sessions_snapshot"; sessions: SessionState[] }
  | { type: "action_request"; action: PendingAction }
  | { type: "action_resolved"; action_id: string }
  | { type: "ping"; ts: number }
  // ── Channel protocol ──
  // Browser → DO → Channel MCP server: push a message into a running session
  | { type: "channel_message"; session_id: string; content: string; user?: string; source?: string }
  // Channel MCP server → DO → Browser: Claude's reply via the `reply` tool
  | { type: "channel_reply"; session_id: string; content: string }
  // Channel MCP server → DO: on connect, register this socket for a specific session_id
  | { type: "channel_identify"; session_id: string }
  // DO → Browser: channel connectivity status for a session
  | { type: "channel_status"; session_id: string; connected: boolean };

// All 27 Claude Code hook events — the type union above covers all of them.
// The CLI and plugin only register 12 core events (marked with *) for monitoring.
// The rest are available but not registered by default to reduce noise.
export const HOOK_EVENTS: HookEventName[] = [
  "SessionStart", // * session lifecycle
  "SessionEnd", // * session lifecycle
  "Setup", // * initial setup
  "PreToolUse", // * tool activity start
  "PostToolUse", // * tool completion
  "PostToolUseFailure",
  "Stop", // * session completion
  "StopFailure", // * error tracking
  "SubagentStart", // * agent hierarchy
  "SubagentStop", // * agent hierarchy
  "UserPromptSubmit", // * what user is asking
  "Notification", // * needs input / completion
  "PreCompact",
  "PostCompact", // * context overflow tracking
  "PermissionRequest",
  "PermissionDenied",
  "TaskCreated",
  "TaskCompleted",
  "TeammateIdle",
  "CwdChanged",
  "FileChanged",
  "ConfigChange",
  "WorktreeCreate",
  "WorktreeRemove",
  "InstructionsLoaded",
  "Elicitation",
  "ElicitationResult",
];

// The 12 core monitoring events registered by the CLI and plugin.
// These capture full session lifecycle without noise.
export const CORE_HOOK_EVENTS: HookEventName[] = [
  "SessionStart",
  "SessionEnd",
  "Setup",
  "PreToolUse",
  "PostToolUse",
  "Stop",
  "StopFailure",
  "SubagentStart",
  "SubagentStop",
  "UserPromptSubmit",
  "Notification",
  "PostCompact",
];

// Status derivation helpers
export const TOOL_CATEGORIES = {
  edits: new Set(["Edit", "Write", "NotebookEdit"]),
  commands: new Set(["Bash"]),
  reads: new Set(["Read"]),
  searches: new Set(["Grep", "Glob"]),
  monitors: new Set(["Monitor"]),
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
  working: "#a3b18a", // safe green
  thinking: "#7b9fbf", // blue
  waiting: "#c9a96e", // suspicious amber
  done: "#666", // gray
  error: "#b85c4a", // attack red
  offline: "#333", // dark
};

// ── Hook Response Schemas ────────────────────────────────────────
// Response types that action hooks must return for Claude Code.

export interface PermissionHookResponse {
  hookSpecificOutput: {
    hookEventName: "PermissionRequest";
    decision: { behavior: "allow" | "deny" };
  };
}

export interface NotificationHookResponse {
  additionalContext?: string;
}

export interface ElicitationHookResponse {
  hookSpecificOutput: {
    hookEventName: "Elicitation";
    action: "accept" | "decline";
  };
}

export type HookResponse = PermissionHookResponse | NotificationHookResponse | ElicitationHookResponse;
