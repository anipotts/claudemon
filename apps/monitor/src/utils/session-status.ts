import type { MonitorEvent, SessionState } from "../../../../packages/types/monitor";
import { summarizeMonitorTarget } from "./monitor";
import { formatDuration } from "./time";

export function toolTarget(event: MonitorEvent): string {
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
  if (name === "Monitor") return summarizeMonitorTarget(input, 50) || "";
  return "";
}

export function computeSmartStatus(session: SessionState, event: MonitorEvent): string {
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
  if (name === "PostToolUse" && event.tool_name === "Monitor") {
    const target = toolTarget(event);
    return target ? `Watching: ${target}` : "Watching in background";
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
    const wt = (event as { worktree_name?: string }).worktree_name || "";
    return wt ? `Worktree created: ${wt}` : "Worktree created";
  }
  if (name === "WorktreeRemove") {
    const wt = (event as { worktree_name?: string }).worktree_name || "";
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
