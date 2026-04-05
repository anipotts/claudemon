// Event helpers extracted from index.ts for testability

export function enrichEvent(event: any, userId: string) {
  if (!event.timestamp) event.timestamp = Date.now();
  if (!event.machine_id) event.machine_id = userId || "unknown";
  if (!event.project_path) event.project_path = event.cwd || "unknown";

  // Normalize Claude Code native field names -> ClaudeMon field names.
  // CC hook payloads use short field names (e.g. "message" on Notification);
  // MonitorEvent uses namespaced names (e.g. "notification_message").
  if (event.hook_event_name === "Notification") {
    if (event.message && !event.notification_message) event.notification_message = event.message;
    if (event.title && !event.notification_title) event.notification_title = event.title;
    if (event.notification_type === undefined && event.type) event.notification_type = event.type;
  }
  if (event.hook_event_name === "SessionEnd") {
    if (event.reason && !event.end_reason) event.end_reason = event.reason;
  }
  if (event.hook_event_name === "PermissionDenied") {
    if (event.reason && !event.permission_denied_reason) event.permission_denied_reason = event.reason;
  }
  if (event.hook_event_name === "PreCompact" || event.hook_event_name === "PostCompact") {
    if (event.trigger && !event.compact_trigger) event.compact_trigger = event.trigger;
    if (event.compact_summary === undefined && event.summary) event.compact_summary = event.summary;
  }
  if (event.hook_event_name === "FileChanged") {
    if (event.event && !event.file_event) event.file_event = event.event;
  }
  if (event.hook_event_name === "WorktreeCreate") {
    if (event.name && !event.worktree_name) event.worktree_name = event.name;
  }
  if (event.hook_event_name === "ConfigChange") {
    if (event.source && !event.config_source) event.config_source = event.source;
    if (event.file_path && !event.config_file_path) event.config_file_path = event.file_path;
  }
  // SubagentStop: normalize agent_transcript_path → transcript_path for subagent
  if (event.hook_event_name === "SubagentStop") {
    if (event.agent_transcript_path && !event.transcript_path) {
      event.transcript_path = event.agent_transcript_path;
    }
  }
}

export function isValidEvent(event: any): boolean {
  return (
    typeof event === "object" &&
    event !== null &&
    typeof event.session_id === "string" &&
    event.session_id.length > 0 &&
    typeof event.hook_event_name === "string" &&
    event.hook_event_name.length > 0
  );
}

export function sendEvent(room: { fetch: (req: Request) => Promise<Response> }, event: any) {
  return room.fetch(
    new Request("https://do/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }),
  );
}
