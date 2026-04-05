import { type Component, For, Show } from "solid-js";
import type { MonitorEvent } from "../../../../packages/types/monitor";
import { Terminal, Circle } from "./Icons";
import { FileBadge } from "./FileBadge";
import { Timestamp } from "./Timestamp";

const SESSION_COLORS = ["#a3b18a", "#c9a96e", "#7ea8be", "#b07bac", "#8a8478", "#7b9fbf"];

export function hashSessionColor(sessionId: string): string {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
  }
  return SESSION_COLORS[Math.abs(hash) % SESSION_COLORS.length];
}

const TOOL_ICONS: Record<string, string> = {
  Read: ".", Edit: "~", Write: "+", Bash: ">_", Grep: "?", Glob: "*", Agent: "@",
  SessionStart: ">>", SessionEnd: "||", Stop: "||", StopFailure: "!!",
  Notification: "?!", PostToolUseFailure: "!!", PreCompact: "<<", PostCompact: ">>",
  PermissionRequest: ">>", PermissionDenied: "xx", SubagentStart: "@+", SubagentStop: "@-",
  UserPromptSubmit: ">",
};

const ACTION_COLORS: Record<string, string> = {
  // Tool colors
  Read: "#6b6560", Edit: "#c9a96e", Write: "#a3b18a", Bash: "#7ea8be",
  Grep: "#6b6560", Glob: "#6b6560", Agent: "#b07bac",
  // Event colors
  SessionStart: "#a3b18a", SessionEnd: "#666",
  Stop: "#666", StopFailure: "#b85c4a",
  Notification: "#c9a96e",
  PostToolUseFailure: "#b85c4a",
  PreCompact: "#7b9fbf", PostCompact: "#7b9fbf",
  PermissionRequest: "#c9a96e", PermissionDenied: "#b85c4a",
  SubagentStart: "#b07bac", SubagentStop: "#b07bac",
  UserPromptSubmit: "#8a8478",
};

function EventRow(props: { event: MonitorEvent; onSelect?: (id: string) => void }) {
  const e = () => props.event;
  const color = () => ACTION_COLORS[e().tool_name || ""] || ACTION_COLORS[e().hook_event_name] || "#6b6560";
  const sessionColor = () => hashSessionColor(e().session_id);

  const filePath = () => {
    const input = e().tool_input || {};
    return (input.file_path as string) || null;
  };

  const summary = () => {
    const input = e().tool_input || {};
    // Tool events
    if (e().tool_name === "Bash") return (input.command as string || "").slice(0, 50);
    if (e().tool_name === "Grep") return `/${input.pattern || ""}/`;
    if (e().tool_name === "Glob") return (input.pattern as string || "");
    if (e().tool_name === "Agent") return (input.description as string || "").slice(0, 40);

    // Lifecycle events
    if (e().hook_event_name === "SessionStart") return e().source || "started";
    if (e().hook_event_name === "SessionEnd") return e().end_reason || "ended";
    if (e().hook_event_name === "Notification") return (e().notification_message || "waiting").slice(0, 50);
    if (e().hook_event_name === "PostToolUseFailure") return (e().error || "failed").slice(0, 50);
    if (e().hook_event_name === "StopFailure") return (e().error || "error").slice(0, 50);
    if (e().hook_event_name === "PreCompact") return "compacting context...";
    if (e().hook_event_name === "PostCompact") return "context compacted";
    if (e().hook_event_name === "PermissionRequest") return `${e().tool_name || "tool"} needs permission`;
    if (e().hook_event_name === "PermissionDenied") return `${e().tool_name || "tool"} denied`;
    if (e().hook_event_name === "SubagentStart") return e().agent_type || "agent spawned";
    if (e().hook_event_name === "SubagentStop") return e().agent_type || "agent done";
    if (e().hook_event_name === "UserPromptSubmit") return "user prompt";

    return null;
  };

  return (
    <div
      class="flex items-start gap-2 py-1.5 px-2 hover:bg-panel/30 rounded-sm event-enter cursor-pointer"
      onClick={() => props.onSelect?.(e().session_id)}
    >
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 flex-wrap">
          <span
            class="text-[8px] font-bold uppercase tracking-wider px-1 rounded-sm"
            style={{ color: sessionColor(), background: sessionColor() + "15" }}
          >
            {e().session_id.slice(0, 6)}
          </span>
          <span class="text-[9px] text-text-dim w-3.5 text-center shrink-0 font-mono" style={{ color: color() }}>
            {TOOL_ICONS[e().tool_name || ""] || TOOL_ICONS[e().hook_event_name] || "o"}
          </span>
          <span class="text-[10px] font-bold uppercase" style={{ color: color() }}>
            {e().tool_name || e().hook_event_name}
          </span>
          <Show when={e().hook_event_name === "PostToolUseFailure" || e().hook_event_name === "StopFailure"}>
            <span class="text-[8px] text-attack font-bold px-1 rounded-sm bg-attack/10">ERR</span>
          </Show>
        </div>
        <div class="mt-0.5">
          <Show when={filePath()} fallback={
            <Show when={summary()}>
              <span class="text-[10px] text-text-dim truncate block">{summary()}</span>
            </Show>
          }>
            <FileBadge path={filePath()!} />
          </Show>
        </div>
      </div>
      <Timestamp ts={e().timestamp} class="text-[9px] text-text-sub shrink-0 mt-1" />
    </div>
  );
}

export const ActivityTimeline: Component<{
  events: MonitorEvent[];
  onSelectSession?: (id: string) => void;
}> = (props) => {
  // Only show PostToolUse (skip PreToolUse duplicates) + lifecycle events
  const filteredEvents = () =>
    props.events
      .filter((e) =>
        (e.hook_event_name === "PostToolUse" && e.tool_name) ||
        e.hook_event_name === "PostToolUseFailure" ||
        e.hook_event_name === "SessionStart" ||
        e.hook_event_name === "SessionEnd" ||
        e.hook_event_name === "Stop" ||
        e.hook_event_name === "StopFailure" ||
        e.hook_event_name === "Notification" ||
        e.hook_event_name === "PreCompact" ||
        e.hook_event_name === "PostCompact" ||
        e.hook_event_name === "PermissionRequest" ||
        e.hook_event_name === "PermissionDenied" ||
        e.hook_event_name === "SubagentStart" ||
        e.hook_event_name === "SubagentStop" ||
        e.hook_event_name === "UserPromptSubmit"
      )
      .slice(0, 100);

  return (
    <Show
      when={filteredEvents().length > 0}
      fallback={
        <div class="flex flex-col items-center justify-center py-8 gap-2">
          <Terminal size={24} class="text-text-sub" />
          <span class="text-[11px] text-text-dim">No activity yet</span>
        </div>
      }
    >
      <div class="space-y-0.5">
        <For each={filteredEvents()}>
          {(event) => <EventRow event={event} onSelect={props.onSelectSession} />}
        </For>
      </div>
    </Show>
  );
};
