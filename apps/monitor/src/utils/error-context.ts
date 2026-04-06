// ── Deterministic Error Context Extraction ────────────────────────
// Zero AI. Taint-propagation graph traversal on the event timeline.
//
// Algorithm:
// 1. Start at error event, extract affected file paths
// 2. Backward taint walk: trace files the error touches, walk FURTHER back
//    past UserPromptSubmit to find the FIRST mutation of those files
// 3. Cross-session write-before-read: for each file in the causal chain,
//    query IndexedDB for Edit/Write events from OTHER sessions before the error
// 4. Format as structured markdown with granular timestamps

import type { MonitorEvent, SessionState } from "../../../../packages/types/monitor";
import { queryByFile, queryWritesBefore } from "../stores/persistence";
import { formatTime } from "./time";

interface ErrorContext {
  error: MonitorEvent;
  causalChain: MonitorEvent[];
  taintedFiles: Set<string>;
  crossSessionCauses: Array<{ file: string; event: MonitorEvent; session_id: string }>;
  relatedFiles: Map<string, { sessions: Set<string>; count: number }>;
  session: SessionState;
}

/**
 * Extract error context using taint-propagation graph traversal.
 *
 * 1. Start at the error event
 * 2. Extract file paths the error touches → these are "tainted"
 * 3. Walk backward through ALL session events (not just to nearest prompt):
 *    - Find the FIRST mutation (Edit/Write) of each tainted file
 *    - Any event that reads/touches a tainted file is part of the chain
 * 4. Query IndexedDB for cross-session writes to tainted files
 */
export async function extractErrorContext(
  session: SessionState,
  errorEvent: MonitorEvent,
): Promise<ErrorContext> {
  const events = session.events;
  const errorIdx = events.findIndex(
    (e) => e.timestamp === errorEvent.timestamp && e.hook_event_name === errorEvent.hook_event_name,
  );
  const startIdx = errorIdx >= 0 ? errorIdx : events.length - 1;

  // Step 1: Collect file paths from the error event itself
  const taintedFiles = new Set<string>();
  const errorFp = extractFilePath(errorEvent);
  if (errorFp) taintedFiles.add(errorFp);

  // Also check if a Bash command references tainted files
  if (errorEvent.tool_name === "Bash" && errorEvent.tool_response) {
    const output = JSON.stringify(errorEvent.tool_response);
    // Scan for file paths in error output (heuristic: look for paths with extensions)
    for (const fp of events.map(extractFilePath).filter(Boolean) as string[]) {
      if (output.includes(fp.split("/").pop()!)) taintedFiles.add(fp);
    }
  }

  // Step 2: Backward taint walk — go all the way back, not just to nearest prompt
  const chain: MonitorEvent[] = [];
  let promptFound = false;
  for (let i = startIdx; i >= 0 && chain.length < 30; i--) {
    const e = events[i];
    const fp = extractFilePath(e);

    // If this event touches a tainted file, include it in the chain
    if (fp && taintedFiles.has(fp)) {
      chain.unshift(e);
      continue;
    }

    // If this event MUTATES a file, taint that file
    if (fp && (e.tool_name === "Edit" || e.tool_name === "Write")) {
      // Check if any later event in the chain reads this file
      // → taint propagation: write to X, later read from X → X is tainted
      taintedFiles.add(fp);
      chain.unshift(e);
      continue;
    }

    // Always include the error event itself and prompts
    if (i === startIdx) {
      chain.unshift(e);
      continue;
    }

    // Include UserPromptSubmit as context markers
    if (e.hook_event_name === "UserPromptSubmit") {
      chain.unshift(e);
      if (promptFound) break; // Stop at second prompt
      promptFound = true;
      continue;
    }

    // Include events between prompts if they're tool events
    if (!promptFound && (e.hook_event_name === "PreToolUse" || e.hook_event_name === "PostToolUse")) {
      chain.unshift(e);
    }
  }

  // Step 3: Cross-session write-before-read
  const crossSessionCauses: Array<{ file: string; event: MonitorEvent; session_id: string }> = [];
  for (const fp of taintedFiles) {
    try {
      const writes = await queryWritesBefore(fp, errorEvent.timestamp);
      // Find writes from OTHER sessions
      for (const w of writes) {
        if (w.session_id !== session.session_id) {
          crossSessionCauses.push({ file: fp, event: w, session_id: w.session_id });
          break; // Most recent cross-session write is the likely cause
        }
      }
    } catch {
      // IndexedDB query failed
    }
  }

  // Step 4: Related file activity summary
  const relatedFiles = new Map<string, { sessions: Set<string>; count: number }>();
  for (const fp of taintedFiles) {
    try {
      const fileEvents = await queryByFile(fp);
      const sessions = new Set<string>();
      for (const fe of fileEvents) sessions.add(fe.session_id);
      relatedFiles.set(fp, { sessions, count: fileEvents.length });
    } catch {}
  }

  return { error: errorEvent, causalChain: chain, taintedFiles, crossSessionCauses, relatedFiles, session };
}

function extractFilePath(event: MonitorEvent): string | null {
  if (event.file_path) return event.file_path;
  const input = event.tool_input || {};
  if (input.file_path) return input.file_path as string;
  return null;
}

function formatEventLine(event: MonitorEvent): string {
  const ts = formatTime(event.timestamp);
  const name = event.hook_event_name;
  const tool = event.tool_name || "";

  if (name === "UserPromptSubmit") {
    const prompt = event.prompt?.slice(0, 80) || "";
    return `[${ts}] UserPromptSubmit: "${prompt}"`;
  }
  if (name === "PreToolUse" || name === "PostToolUse") {
    const fp = extractFilePath(event);
    const detail = fp ? fp.split("/").slice(-2).join("/") : "";
    if (tool === "Bash") {
      const cmd = ((event.tool_input?.command as string) || "").slice(0, 80);
      return `[${ts}] ${tool}: ${cmd}`;
    }
    if (tool === "Edit" || tool === "Write") {
      const old = (event.tool_input?.old_string as string) || "";
      const nw = (event.tool_input?.new_string as string) || "";
      let diff = "";
      if (old || nw) {
        diff = `\n  -${old.split("\n")[0]?.slice(0, 60) || ""}\n  +${nw.split("\n")[0]?.slice(0, 60) || ""}`;
      }
      return `[${ts}] ${tool} ${detail}${diff}`;
    }
    return `[${ts}] ${tool} ${detail}`;
  }
  if (name === "PostToolUseFailure") {
    const cmd = tool === "Bash" ? ((event.tool_input?.command as string) || "").slice(0, 60) : "";
    const err = event.error || "";
    return `[${ts}] ${tool}${cmd ? `: ${cmd}` : ""} FAILED${err ? ` — ${err.slice(0, 80)}` : ""}`;
  }
  if (name === "StopFailure") {
    return `[${ts}] StopFailure: ${(event.error || "").slice(0, 80)}`;
  }
  if (name === "SessionStart") return `[${ts}] Session started`;
  return `[${ts}] ${name}${tool ? ` ${tool}` : ""}`;
}

/**
 * Format an ErrorContext as structured markdown suitable for pasting to Claude.
 */
export function formatAsMarkdown(ctx: ErrorContext): string {
  const { error, causalChain, taintedFiles, crossSessionCauses, relatedFiles, session } = ctx;
  const ts = new Date(error.timestamp).toISOString();
  const projectName = session.project_name || session.project_path.split("/").pop() || "unknown";

  let md = `## Error Context — ${projectName} @ ${ts}\n\n`;

  // Error section
  const errTool = error.tool_name || "unknown";
  const errMsg = error.error || error.error_details || "";
  const errCmd = error.tool_name === "Bash" ? ((error.tool_input?.command as string) || "") : "";
  md += `### Error\n`;
  md += `[${error.hook_event_name}] ${errTool} at ${formatTime(error.timestamp)}\n`;
  if (errCmd) md += `$ ${errCmd}\n`;
  if (errMsg) md += `${errMsg}\n`;
  md += `\n`;

  // Cross-session root causes
  if (crossSessionCauses.length > 0) {
    md += `### Cross-Session Root Cause\n`;
    for (const cause of crossSessionCauses) {
      const shortFp = cause.file.split("/").slice(-3).join("/");
      const causeTs = formatTime(cause.event.timestamp);
      const deltaMs = error.timestamp - cause.event.timestamp;
      const deltaStr = deltaMs < 60000 ? `${Math.round(deltaMs / 1000)}s` : `${Math.round(deltaMs / 60000)}m`;
      md += `- ${shortFp} was edited in session ${cause.session_id.slice(0, 8)} at ${causeTs} (${deltaStr} before this error)\n`;
    }
    md += `\n`;
  }

  // Causal chain
  const duration = causalChain.length > 1
    ? ((causalChain[causalChain.length - 1].timestamp - causalChain[0].timestamp) / 1000).toFixed(1) + "s"
    : "0s";
  md += `### Causal Chain (${causalChain.length} events, ${duration})\n`;
  for (const e of causalChain) {
    md += formatEventLine(e) + "\n";
  }
  md += `\n`;

  // Tainted files
  if (taintedFiles.size > 0) {
    md += `### Tainted Files\n`;
    for (const fp of taintedFiles) {
      const shortFp = fp.split("/").slice(-3).join("/");
      const info = relatedFiles.get(fp);
      const extra = info ? ` — ${info.count} events across ${info.sessions.size} session${info.sessions.size > 1 ? "s" : ""}` : "";
      md += `- ${shortFp}${extra}\n`;
    }
    md += `\n`;
  }

  // Session metadata
  const dur = session.started_at ? `${Math.floor((Date.now() - session.started_at) / 60000)}m` : "unknown";
  md += `### Session\n`;
  md += `Model: ${session.model || "unknown"} | Branch: ${session.branch || "unknown"} | Duration: ${dur} | Errors: ${session.error_count}\n`;

  return md;
}

/**
 * Format as a prompt for Claude — includes a "fix this" preamble.
 */
export function formatAsPrompt(ctx: ErrorContext): string {
  return `The following error occurred during a Claude Code session. Please analyze the causal chain and suggest a fix.\n\n${formatAsMarkdown(ctx)}`;
}
