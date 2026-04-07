// ── Client-Side Event Normalization ─────────────────────────────
// Mirrors the server-side enrichEvent() from monitor-api/src/events.ts.
// Claude Code hook payloads use short field names (e.g., "message" on Notification);
// MonitorEvent uses namespaced names (e.g., "notification_message").
// Called before state derivation to handle events that bypass server normalization
// (e.g., decrypted transit payloads, future direct-connect plugins).

import type { MonitorEvent } from "../../../../packages/types/monitor";

export function normalizeEvent(event: MonitorEvent): void {
  const e = event as any;
  const name = e.hook_event_name;

  // Hook scripts may stringify tool_input / tool_response — parse them back to objects
  if (typeof e.tool_input === "string" && e.tool_input) {
    try {
      e.tool_input = JSON.parse(e.tool_input);
    } catch {
      /* leave as-is */
    }
  }
  if (typeof e.tool_response === "string" && e.tool_response) {
    try {
      e.tool_response = JSON.parse(e.tool_response);
    } catch {
      /* leave as-is */
    }
  }

  if (name === "Notification") {
    if (e.message && !e.notification_message) e.notification_message = e.message;
    if (e.title && !e.notification_title) e.notification_title = e.title;
    if (e.notification_type === undefined && e.type) e.notification_type = e.type;
  }
  if (name === "SessionEnd") {
    if (e.reason && !e.end_reason) e.end_reason = e.reason;
  }
  if (name === "PermissionDenied") {
    if (e.reason && !e.permission_denied_reason) e.permission_denied_reason = e.reason;
  }
  if (name === "PreCompact" || name === "PostCompact") {
    if (e.trigger && !e.compact_trigger) e.compact_trigger = e.trigger;
    if (e.compact_summary === undefined && e.summary) e.compact_summary = e.summary;
  }
  if (name === "FileChanged") {
    if (e.event && !e.file_event) e.file_event = e.event;
  }
  if (name === "WorktreeCreate") {
    if (e.name && !e.worktree_name) e.worktree_name = e.name;
  }
  if (name === "ConfigChange") {
    if (e.source && !e.config_source) e.config_source = e.source;
    if (e.file_path && !e.config_file_path) e.config_file_path = e.file_path;
  }
  if (name === "SubagentStop") {
    if (e.agent_transcript_path && !e.transcript_path) {
      e.transcript_path = e.agent_transcript_path;
    }
  }
}
