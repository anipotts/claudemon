import { type Component, For, Show, createSignal, createMemo } from "solid-js";
import type { MonitorEvent, HookEventName } from "../../../../packages/types/monitor";
import { Terminal } from "./Icons";
import { FileBadge } from "./FileBadge";
import { SessionBadge, hashSessionColor } from "./SessionBadge";
import { timeAgo } from "../utils/time";
import { getEventTier } from "../stores/persistence";

// ── Icon + color maps ──────────────────────────────────────────────

const TOOL_ICONS: Record<string, string> = {
  Read: ".",
  Edit: "~",
  Write: "+",
  Bash: ">_",
  Grep: "?",
  Glob: "*",
  Agent: "@",
  SessionStart: ">>",
  SessionEnd: "||",
  Stop: "||",
  StopFailure: "!!",
  Notification: "?!",
  PostToolUseFailure: "!!",
  PreCompact: "<<",
  PostCompact: ">>",
  PermissionRequest: ">>",
  PermissionDenied: "xx",
  SubagentStart: "@+",
  SubagentStop: "@-",
  UserPromptSubmit: ">",
};

const ACTION_COLORS: Record<string, string> = {
  Read: "#6b6560",
  Edit: "#c9a96e",
  Write: "#a3b18a",
  Bash: "#7ea8be",
  Grep: "#6b6560",
  Glob: "#6b6560",
  Agent: "#b07bac",
  SessionStart: "#a3b18a",
  SessionEnd: "#666",
  Stop: "#666",
  StopFailure: "#b85c4a",
  Notification: "#c9a96e",
  PostToolUseFailure: "#b85c4a",
  PreCompact: "#7b9fbf",
  PostCompact: "#7b9fbf",
  PermissionRequest: "#c9a96e",
  PermissionDenied: "#b85c4a",
  SubagentStart: "#b07bac",
  SubagentStop: "#b07bac",
  UserPromptSubmit: "#8a8478",
};

// ── Event severity for visual weight ───────────────────────────────

type Severity = "error" | "warning" | "lifecycle" | "tool" | "info";

function eventSeverity(e: MonitorEvent): Severity {
  if (e.hook_event_name === "PostToolUseFailure" || e.hook_event_name === "StopFailure") return "error";
  if (
    e.hook_event_name === "Notification" ||
    e.hook_event_name === "PermissionRequest" ||
    e.hook_event_name === "PermissionDenied"
  )
    return "warning";
  if (
    e.hook_event_name === "SessionStart" ||
    e.hook_event_name === "SessionEnd" ||
    e.hook_event_name === "Stop" ||
    e.hook_event_name === "SubagentStart" ||
    e.hook_event_name === "SubagentStop"
  )
    return "lifecycle";
  if (e.tool_name) return "tool";
  return "info";
}

const SEVERITY_BG: Record<Severity, string> = {
  error: "bg-attack/8 border-l-2 border-l-attack",
  warning: "bg-suspicious/5 border-l-2 border-l-suspicious",
  lifecycle: "border-l-2 border-l-text-sub/30",
  tool: "",
  info: "",
};

// ── Detail extraction ──────────────────────────────────────────────

function getEventDetail(e: MonitorEvent): {
  primary: string | null;
  secondary: string | null;
  filePath: string | null;
  diffStat: { added: number; removed: number } | null;
} {
  const input = e.tool_input || {};
  const response = e.tool_response || {};
  let primary: string | null = null;
  let secondary: string | null = null;
  const filePath: string | null = (input.file_path as string) || null;
  let diffStat: { added: number; removed: number } | null = null;

  if (e.tool_name === "Bash") {
    primary = ((input.command as string) || "").slice(0, 80);
    const stdout = (response.stdout as string) || (response.output as string) || "";
    if (stdout && stdout.length < 100) secondary = stdout.trim();
    const exitCode = response.exitCode ?? response.exit_code;
    if (exitCode !== undefined && exitCode !== 0) secondary = `exit ${exitCode}`;
  } else if (e.tool_name === "Edit") {
    const oldS = input.old_string as string;
    const newS = input.new_string as string;
    if (oldS || newS) {
      const removed = oldS ? oldS.split("\n").length : 0;
      const added = newS ? newS.split("\n").length : 0;
      diffStat = { added, removed };
    }
  } else if (e.tool_name === "Write") {
    const content = input.content as string;
    if (content) secondary = `${content.split("\n").length} lines`;
  } else if (e.tool_name === "Read") {
    const content = (response.content as string) || (response.output as string) || "";
    if (content) secondary = `${content.split("\n").length} lines`;
  } else if (e.tool_name === "Grep") {
    primary = `/${input.pattern || ""}/`;
    if (input.path) secondary = `in ${(input.path as string).split("/").pop()}`;
  } else if (e.tool_name === "Glob") {
    primary = (input.pattern as string) || "";
  } else if (e.tool_name === "Agent") {
    primary = ((input.description as string) || "").slice(0, 60);
    if (input.subagent_type) secondary = input.subagent_type as string;
  } else if (e.hook_event_name === "SessionStart") {
    primary = e.source || "started";
    if (e.model) secondary = e.model.replace("claude-", "").replace(/-\d+$/, "");
  } else if (e.hook_event_name === "SessionEnd") {
    primary = e.end_reason || "ended";
  } else if (e.hook_event_name === "Notification") {
    primary = (e.notification_message || "waiting for input").slice(0, 60);
  } else if (e.hook_event_name === "PostToolUseFailure") {
    primary = (e.error || "failed").slice(0, 60);
  } else if (e.hook_event_name === "StopFailure") {
    primary = (e.error || "API error").slice(0, 60);
  } else if (e.hook_event_name === "PreCompact") {
    primary = "compacting context...";
  } else if (e.hook_event_name === "PostCompact") {
    primary = "context compacted";
    if (e.compact_summary) secondary = e.compact_summary.slice(0, 60);
  } else if (e.hook_event_name === "PermissionRequest") {
    primary = `${e.tool_name || "tool"} needs permission`;
  } else if (e.hook_event_name === "PermissionDenied") {
    primary = `${e.tool_name || "tool"} denied`;
    if (e.permission_denied_reason) secondary = e.permission_denied_reason.slice(0, 50);
  } else if (e.hook_event_name === "SubagentStart") {
    primary = e.agent_type || "agent spawned";
  } else if (e.hook_event_name === "SubagentStop") {
    primary = e.agent_type || "agent done";
  } else if (e.hook_event_name === "UserPromptSubmit") {
    primary = (e.prompt || "user prompt").slice(0, 60);
  }

  return { primary, secondary, filePath, diffStat };
}

// ── Event Row ──────────────────────────────────────────────────────

function EventRow(props: { event: MonitorEvent; onSelect?: (id: string) => void; compact?: boolean }) {
  const e = () => props.event;
  const severity = () => eventSeverity(e());
  const tier = () => getEventTier(e().hook_event_name as HookEventName);
  const color = () => ACTION_COLORS[e().tool_name || ""] || ACTION_COLORS[e().hook_event_name] || "#6b6560";
  const sessionColor = () => hashSessionColor(e().session_id);
  const detail = () => getEventDetail(e());
  const icon = () => TOOL_ICONS[e().tool_name || ""] || TOOL_ICONS[e().hook_event_name] || "o";
  const toolName = () => e().tool_name || e().hook_event_name;
  const isDimmed = () => tier() >= 3;

  return (
    <div
      class={`py-1 px-2 hover:bg-panel/30 rounded-sm event-enter cursor-pointer transition-colors ${SEVERITY_BG[severity()]} ${isDimmed() ? "opacity-50" : ""}`}
      onClick={() => props.onSelect?.(e().session_id)}
    >
      {/* Single row: badge · icon · tool · detail/file · time */}
      <div class="flex items-center gap-1 overflow-hidden" style={{ "white-space": "nowrap" }}>
        <SessionBadge
          sessionId={e().session_id}
          projectName={e().project_path?.split("/").pop()}
          onClick={() => props.onSelect?.(e().session_id)}
        />
        <span class="text-[9px] w-3 text-center font-mono shrink-0" style={{ color: color() }}>
          {icon()}
        </span>
        <span class="text-[9px] font-bold uppercase shrink-0" style={{ color: color() }}>
          {toolName()}
        </span>
        <Show when={detail().diffStat}>
          {(ds) => (
            <span class="text-[8px] font-mono shrink-0">
              <span class="text-safe">+{ds().added}</span> <span class="text-attack">-{ds().removed}</span>
            </span>
          )}
        </Show>
        <Show when={severity() === "error"}>
          <span class="text-[9px] text-attack font-bold px-1 rounded-sm bg-attack/15 uppercase shrink-0">err</span>
        </Show>
        <Show when={detail().filePath}>
          <FileBadge path={detail().filePath!} />
        </Show>
        <Show when={!detail().filePath && detail().primary}>
          <span class="text-[9px] text-text-dim truncate min-w-0">{detail().primary}</span>
        </Show>
        <Show when={detail().secondary}>
          <span class="text-[8px] text-text-sub truncate min-w-0">{detail().secondary}</span>
        </Show>
        <span class="text-[8px] text-text-sub shrink-0 ml-auto font-mono">{timeAgo(e().timestamp)}</span>
      </div>
    </div>
  );
}

// ── Filter types ───────────────────────────────────────────────────

type FilterType = "all" | "signals" | "tools" | "lifecycle" | "prompts" | "agents" | "errors";

// ── Main Component ─────────────────────────────────────────────────

export const ActivityTimeline: Component<{
  events: MonitorEvent[];
  onSelectSession?: (id: string) => void;
}> = (props) => {
  const [filter, setFilter] = createSignal<FilterType>("all");

  const baseEvents = createMemo(() =>
    props.events.filter(
      (e) =>
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
        e.hook_event_name === "UserPromptSubmit",
    ),
  );

  const filteredEvents = createMemo(() => {
    const all = baseEvents();
    switch (filter()) {
      case "signals":
        return all.filter((e) => getEventTier(e.hook_event_name as HookEventName) === 1).slice(0, 100);
      case "tools":
        return all.filter((e) => e.tool_name).slice(0, 100);
      case "lifecycle":
        return all
          .filter((e) => eventSeverity(e) === "lifecycle" || e.hook_event_name === "UserPromptSubmit")
          .slice(0, 100);
      case "prompts":
        return all.filter((e) => e.hook_event_name === "UserPromptSubmit").slice(0, 100);
      case "agents":
        return all
          .filter((e) => e.hook_event_name === "SubagentStart" || e.hook_event_name === "SubagentStop")
          .slice(0, 100);
      case "errors":
        return all.filter((e) => eventSeverity(e) === "error" || eventSeverity(e) === "warning").slice(0, 100);
      default:
        return all.slice(0, 100);
    }
  });

  const errorCount = createMemo(() => baseEvents().filter((e) => eventSeverity(e) === "error").length);
  const signalCount = createMemo(
    () => baseEvents().filter((e) => getEventTier(e.hook_event_name as HookEventName) === 1).length,
  );
  const filterCounts = createMemo(() => {
    const all = baseEvents();
    return {
      all: all.length,
      signals: signalCount(),
      tools: all.filter((e) => e.tool_name).length,
      lifecycle: all.filter((e) => eventSeverity(e) === "lifecycle" || e.hook_event_name === "UserPromptSubmit").length,
      prompts: all.filter((e) => e.hook_event_name === "UserPromptSubmit").length,
      agents: all.filter((e) => e.hook_event_name === "SubagentStart" || e.hook_event_name === "SubagentStop").length,
      errors: all.filter((e) => eventSeverity(e) === "error" || eventSeverity(e) === "warning").length,
    };
  });

  return (
    <div class="flex flex-col h-full">
      {/* Filter tabs */}
      <Show when={baseEvents().length > 0}>
        <div class="flex items-center gap-0.5 px-2 py-1.5 border-b border-panel-border/50 shrink-0">
          <For each={["all", "signals", "tools", "lifecycle", "prompts", "agents", "errors"] as FilterType[]}>
            {(f) => {
              const count = () => filterCounts()[f];
              return (
                <button
                  onClick={() => setFilter(f)}
                  class={`text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded transition-colors ${
                    filter() === f ? "bg-safe/15 text-safe" : "text-text-sub hover:text-text-primary"
                  }`}
                >
                  {f}
                  <Show when={count() > 0 && f !== "all"}>
                    <span
                      class={`ml-0.5 ${f === "errors" ? "text-attack" : f === "signals" ? "text-suspicious" : "text-text-sub"}`}
                    >
                      {count()}
                    </span>
                  </Show>
                </button>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Event list */}
      <div class="flex-1 overflow-y-auto smooth-scroll">
        <Show
          when={filteredEvents().length > 0}
          fallback={
            <div class="flex flex-col items-center justify-center py-8 gap-2">
              <Terminal size={20} class="text-text-sub" />
              <span class="text-[10px] text-text-dim">
                {baseEvents().length > 0 ? `No ${filter()} events` : "No activity yet"}
              </span>
            </div>
          }
        >
          <div class="py-0.5">
            <For each={filteredEvents()}>{(event) => <EventRow event={event} onSelect={props.onSelectSession} />}</For>
          </div>
        </Show>
      </div>
    </div>
  );
};
