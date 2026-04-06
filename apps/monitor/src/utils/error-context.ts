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

type TaintConfidence = "high" | "medium" | "low";

interface CausalEntry {
  event: MonitorEvent;
  confidence: TaintConfidence;
}

interface CrossSessionCause {
  file: string;
  event: MonitorEvent;
  session_id: string;
  bridge?: MonitorEvent; // the Read event in current session that connects the cross-session write to the error
}

interface ErrorContext {
  error: MonitorEvent;
  causalChain: CausalEntry[];
  taintedFiles: Set<string>;
  crossSessionCauses: CrossSessionCause[];
  relatedFiles: Map<string, { sessions: Set<string>; count: number }>;
  session: SessionState;
}

/**
 * Extract file paths from an event's various fields.
 */
function extractFilePath(event: MonitorEvent): string | null {
  if (event.file_path) return event.file_path;
  const input = event.tool_input || {};
  if (input.file_path) return input.file_path as string;
  return null;
}

/**
 * Match a file path against text using last 2 segments for precision.
 * Falls back to basename match if 2-segment match fails.
 */
function fileMatchesText(filePath: string, text: string): boolean {
  const segments = filePath.split("/");
  // Try last 2 segments first (e.g., "src/auth.ts")
  if (segments.length >= 2) {
    const twoSeg = segments.slice(-2).join("/");
    if (text.includes(twoSeg)) return true;
  }
  // Fallback to basename
  const basename = segments.pop()!;
  return text.includes(basename);
}

/**
 * Determine taint confidence for a causal chain event.
 */
function getConfidence(event: MonitorEvent, taintedFiles: Set<string>): TaintConfidence {
  const fp = extractFilePath(event);
  const tool = event.tool_name || "";

  // Direct mutation = high confidence
  if (fp && (tool === "Edit" || tool === "Write" || tool === "NotebookEdit")) return "high";

  // Bash output/command mention = medium
  if (tool === "Bash") return "medium";

  // Read/Grep/Glob of tainted file = low (passive involvement)
  if (fp && taintedFiles.has(fp) && (tool === "Read" || tool === "Grep" || tool === "Glob")) return "low";

  // Default for tool events touching tainted files
  if (fp && taintedFiles.has(fp)) return "medium";

  return "medium";
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
export async function extractErrorContext(session: SessionState, errorEvent: MonitorEvent): Promise<ErrorContext> {
  const events = session.events;
  const errorIdx = events.findIndex(
    (e) => e.timestamp === errorEvent.timestamp && e.hook_event_name === errorEvent.hook_event_name,
  );
  const startIdx = errorIdx >= 0 ? errorIdx : events.length - 1;

  // Step 1: Collect file paths from the error event itself
  const taintedFiles = new Set<string>();
  const errorFp = extractFilePath(errorEvent);
  if (errorFp) taintedFiles.add(errorFp);

  // Scan Bash error output AND command for file paths
  if (errorEvent.tool_name === "Bash") {
    const output = errorEvent.tool_response ? JSON.stringify(errorEvent.tool_response) : "";
    const command = (errorEvent.tool_input?.command as string) || "";
    const scanText = output + " " + command;

    for (const fp of events.map(extractFilePath).filter(Boolean) as string[]) {
      if (fileMatchesText(fp, scanText)) taintedFiles.add(fp);
    }
  }

  // Step 2: Backward taint walk — go all the way back, not just to nearest prompt
  const chain: CausalEntry[] = [];
  // Track reads of tainted files for cross-session bridge detection
  const taintedReads: Map<string, MonitorEvent> = new Map();
  let promptFound = false;

  for (let i = startIdx; i >= 0 && chain.length < 30; i--) {
    const e = events[i];
    const fp = extractFilePath(e);

    // If this event touches a tainted file, include it in the chain
    if (fp && taintedFiles.has(fp)) {
      const confidence = getConfidence(e, taintedFiles);
      chain.unshift({ event: e, confidence });
      // Track reads for bridge detection
      if (e.tool_name === "Read" || e.tool_name === "Grep" || e.tool_name === "Glob") {
        if (!taintedReads.has(fp)) taintedReads.set(fp, e);
      }
      continue;
    }

    // If this event MUTATES a file, taint that file
    if (fp && (e.tool_name === "Edit" || e.tool_name === "Write")) {
      taintedFiles.add(fp);
      chain.unshift({ event: e, confidence: "high" });
      continue;
    }

    // Always include the error event itself
    if (i === startIdx) {
      chain.unshift({ event: e, confidence: "high" });
      continue;
    }

    // Include UserPromptSubmit as context markers
    if (e.hook_event_name === "UserPromptSubmit") {
      chain.unshift({ event: e, confidence: "high" });
      if (promptFound) break; // Stop at second prompt
      promptFound = true;
      continue;
    }

    // Include events between prompts if they're tool events
    if (!promptFound && (e.hook_event_name === "PreToolUse" || e.hook_event_name === "PostToolUse")) {
      chain.unshift({ event: e, confidence: "low" });
    }
  }

  // Step 3: Cross-session write-before-read with bridge detection
  const crossSessionCauses: CrossSessionCause[] = [];
  for (const fp of taintedFiles) {
    try {
      // First: query before the error timestamp (original behavior)
      const writes = await queryWritesBefore(fp, errorEvent.timestamp);
      for (const w of writes) {
        if (w.session_id !== session.session_id) {
          const bridge = taintedReads.get(fp); // Read event that bridges cross-session write to error
          crossSessionCauses.push({ file: fp, event: w, session_id: w.session_id, bridge });
          break; // Most recent cross-session write is the likely cause
        }
      }

      // Enhanced: if we have a bridge (Read) event, also query writes before the Read
      // This captures: A writes file at T=100, B reads at T=150, B errors at T=200
      // The original query finds writes before T=200, but querying before T=150
      // narrows to the actual causal write
      const bridgeEvent = taintedReads.get(fp);
      if (bridgeEvent && bridgeEvent.timestamp < errorEvent.timestamp) {
        const bridgeWrites = await queryWritesBefore(fp, bridgeEvent.timestamp);
        for (const w of bridgeWrites) {
          if (w.session_id !== session.session_id) {
            // Only add if not already found (avoid duplicates)
            if (!crossSessionCauses.some((c) => c.file === fp && c.event.timestamp === w.timestamp)) {
              crossSessionCauses.push({ file: fp, event: w, session_id: w.session_id, bridge: bridgeEvent });
            }
            break;
          }
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

function formatEventLine(entry: CausalEntry): string {
  const { event, confidence } = entry;
  const ts = formatTime(event.timestamp);
  const name = event.hook_event_name;
  const tool = event.tool_name || "";
  const tag = confidence === "high" ? "" : confidence === "medium" ? " [MED]" : " [LOW]";

  if (name === "UserPromptSubmit") {
    const prompt = event.prompt?.slice(0, 80) || "";
    return `[${ts}] UserPromptSubmit: "${prompt}"`;
  }
  if (name === "PreToolUse" || name === "PostToolUse") {
    const fp = extractFilePath(event);
    const detail = fp ? fp.split("/").slice(-2).join("/") : "";
    if (tool === "Bash") {
      const cmd = ((event.tool_input?.command as string) || "").slice(0, 80);
      return `[${ts}]${tag} ${tool}: ${cmd}`;
    }
    if (tool === "Edit" || tool === "Write") {
      const old = (event.tool_input?.old_string as string) || "";
      const nw = (event.tool_input?.new_string as string) || "";
      let diff = "";
      if (old || nw) {
        diff = `\n  -${old.split("\n")[0]?.slice(0, 60) || ""}\n  +${nw.split("\n")[0]?.slice(0, 60) || ""}`;
      }
      return `[${ts}]${tag} ${tool} ${detail}${diff}`;
    }
    return `[${ts}]${tag} ${tool} ${detail}`;
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
  return `[${ts}]${tag} ${name}${tool ? ` ${tool}` : ""}`;
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
  const errCmd = error.tool_name === "Bash" ? (error.tool_input?.command as string) || "" : "";
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
      let line = `- ${shortFp} was edited in session ${cause.session_id.slice(0, 8)} at ${causeTs} (${deltaStr} before this error)`;
      if (cause.bridge) {
        const bridgeTs = formatTime(cause.bridge.timestamp);
        const bridgeTool = cause.bridge.tool_name || "tool";
        line += `\n  Bridge: this session ${bridgeTool} read the file at ${bridgeTs}`;
      }
      md += line + "\n";
    }
    md += `\n`;
  }

  // Causal chain
  const duration =
    causalChain.length > 1
      ? ((causalChain[causalChain.length - 1].event.timestamp - causalChain[0].event.timestamp) / 1000).toFixed(1) + "s"
      : "0s";
  md += `### Causal Chain (${causalChain.length} events, ${duration})\n`;
  for (const entry of causalChain) {
    md += formatEventLine(entry) + "\n";
  }
  md += `\n`;

  // Tainted files
  if (taintedFiles.size > 0) {
    md += `### Tainted Files\n`;
    for (const fp of taintedFiles) {
      const shortFp = fp.split("/").slice(-3).join("/");
      const info = relatedFiles.get(fp);
      const extra = info
        ? ` — ${info.count} events across ${info.sessions.size} session${info.sessions.size > 1 ? "s" : ""}`
        : "";
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
