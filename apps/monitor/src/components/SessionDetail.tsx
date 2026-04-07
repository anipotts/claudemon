import { type Component, For, Show, createMemo, createSignal, createEffect, onCleanup } from "solid-js";
import type { MonitorEvent, SessionState } from "../../../../packages/types/monitor";
import { STATUS_COLORS } from "../../../../packages/types/monitor";
import {
  GitBranch, CaretDown, CaretRight, Key, ShieldCheck, Warning, Check, X,
  Eye, PencilSimple, Plus, Terminal, MagnifyingGlass, Folder, Robot, Circle,
} from "./Icons";
import { Dynamic } from "solid-js/web";
import type { PendingAction } from "../../../../packages/types/monitor";
import { PermissionBadge } from "./PermissionBadge";
import { ModelBadge } from "./ModelBadge";
import { FileBadge } from "./FileBadge";
import { SessionBadge, hashFileColor } from "./SessionBadge";
import { Timestamp } from "./Timestamp";
import { MarkdownBlock } from "./Markdown";
import { formatDuration, formatGapDuration } from "../utils/time";
import { extractErrorContext, formatAsMarkdown } from "../utils/error-context";

type IconComp = Component<{ size?: number; class?: string; style?: Record<string, string> }>;

const TOOL_ICON_MAP: Record<string, IconComp> = {
  Read: Eye,
  Edit: PencilSimple,
  Write: Plus,
  Bash: Terminal,
  Grep: MagnifyingGlass,
  Glob: Folder,
  Agent: Robot,
};

const TOOL_COLORS: Record<string, string> = {
  Read: "#6b6560",
  Edit: "#c9a96e",
  Write: "#a3b18a",
  Bash: "#7ea8be",
  Grep: "#6b6560",
  Glob: "#6b6560",
  Agent: "#b07bac",
};

function durationColor(ms: number | undefined): string {
  if (!ms) return "var(--text-sub)";
  if (ms < 1000) return "var(--text-sub)";
  if (ms < 5000) return "var(--text-dim)";
  if (ms < 15000) return "#c9a96e";
  if (ms < 30000) return "#c9a96e";
  return "#b85c4a";
}

function durationBold(ms: number | undefined): boolean {
  return !!ms && ms >= 15000;
}

// ── Copy Error Context Button ─────────────────────────────────────

function CopyContextBtn(props: { session: SessionState; event: MonitorEvent }) {
  const [copied, setCopied] = createSignal(false);
  const handleCopy = async () => {
    try {
      const ctx = await extractErrorContext(props.session, props.event);
      const md = formatAsMarkdown(ctx);
      await navigator.clipboard.writeText(md);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard write failed
    }
  };
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        handleCopy();
      }}
      class="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm transition-colors shrink-0"
      style={{
        color: copied() ? "#a3b18a" : "#b85c4a",
        background: copied() ? "#a3b18a15" : "#b85c4a15",
      }}
      title="Copy error context to clipboard (structured markdown for Claude)"
    >
      {copied() ? "Copied" : "Copy context"}
    </button>
  );
}

// ── Bash command classification ────────────────────────────────────

function classifyCommand(cmd: string): { label: string; color: string } | null {
  // Strip leading whitespace and cd prefix for chained commands (cd /x && git status)
  const c = cmd.trimStart().replace(/^cd\s+\S+\s*&&\s*/, "");
  if (/^git\s+(commit|push|pull|checkout|merge|rebase|stash|log|diff|status|add|reset|branch)/.test(c))
    return { label: "git", color: "#b07bac" };
  if (/^npm\s+(test|run\s+test|t)\b/.test(c)) return { label: "test", color: "#a3b18a" };
  if (/^npm\s+(run\s+build|run\s+dev|start|install|ci)\b/.test(c)) return { label: "npm", color: "#c9a96e" };
  if (/^(docker|docker-compose)\s/.test(c)) return { label: "docker", color: "#7b9fbf" };
  if (/^curl\s/.test(c)) return { label: "curl", color: "#7b9fbf" };
  if (/^(python3?|node|npx|tsx|bun)\s/.test(c)) return { label: "run", color: "#c9a96e" };
  if (/^(cat|head|tail|less|wc)\s/.test(c)) return { label: "read", color: "#6b6560" };
  if (/^(mkdir|rm|mv|cp|chmod|ln)\s/.test(c)) return { label: "fs", color: "#b85c4a" };
  if (/^(cd|ls|pwd|find|which)\s/.test(c)) return { label: "nav", color: "#6b6560" };
  return null;
}

// ── Agent type colors ─────────────────────────────────────────────

const AGENT_TYPE_COLORS: Record<string, string> = {
  Explore: "#7b9fbf",
  Plan: "#7b9fbf",
  "code-reviewer": "#a3b18a",
  "general-purpose": "#8a8478",
  debugger: "#b85c4a",
  "test-automator": "#c9a96e",
};

function agentColor(type: string): string {
  return AGENT_TYPE_COLORS[type] || "#b07bac";
}

// ── Action Bridge Banner ───────────────────────────────────────────

function ActionBanner(props: {
  actions: PendingAction[];
  onRespond: (actionId: string, hookResponse: Record<string, unknown>) => void;
}) {
  return (
    <For each={props.actions}>
      {(action) => {
        const eventName = () => action.hook_event_name;
        const data = () => action.event_data;
        const toolName = () => (data().tool_name as string) || "";
        const toolInput = () => (data().tool_input as Record<string, unknown>) || {};

        // Countdown from 30s (server timeout)
        const createdAt = Date.now();
        const [remaining, setRemaining] = createSignal(30);
        const tick = setInterval(() => {
          const left = Math.max(0, 30 - Math.floor((Date.now() - createdAt) / 1000));
          setRemaining(left);
          if (left <= 0) clearInterval(tick);
        }, 1000);
        onCleanup(() => clearInterval(tick));

        const description = () => {
          if (eventName() === "PermissionRequest") {
            const cmd = toolInput().command as string | undefined;
            const filePath = toolInput().file_path as string | undefined;
            if (cmd) return `$ ${cmd.slice(0, 80)}`;
            if (filePath) return filePath.split("/").slice(-3).join("/");
            return toolName();
          }
          if (eventName() === "Notification") {
            return (data().notification_message as string) || "Notification";
          }
          return (data().prompt as string) || eventName();
        };

        return (
          <div class="mx-2 mt-2 rounded border border-suspicious/40 bg-[#c9a96e0a] action-banner overflow-hidden">
            <div class="flex items-center gap-2 px-3 py-2">
              <Show
                when={eventName() === "PermissionRequest"}
                fallback={<Warning size={14} class="text-suspicious shrink-0" />}
              >
                <ShieldCheck size={14} class="text-suspicious shrink-0" />
              </Show>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-[10px] font-bold text-suspicious uppercase">
                    {eventName() === "PermissionRequest"
                      ? "Permission Request"
                      : eventName() === "Notification"
                        ? "Notification"
                        : "Elicitation"}
                  </span>
                  <Show when={toolName()}>
                    <span class="text-[9px] font-mono text-text-dim bg-panel-border/20 px-1 rounded-sm">
                      {toolName()}
                    </span>
                  </Show>
                </div>
                <div class="text-[9px] text-text-dim mt-0.5 truncate">{description()}</div>
              </div>
              <span
                class="text-[10px] font-mono font-bold shrink-0"
                style={{ color: remaining() <= 5 ? "#b85c4a" : "#c9a96e" }}
              >
                {remaining()}s
              </span>
            </div>
            <div class="flex border-t border-suspicious/20">
              <button
                class="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase text-safe hover:bg-safe/10 transition-colors"
                onClick={() => {
                  const resp =
                    eventName() === "PermissionRequest"
                      ? { hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "allow" } } }
                      : eventName() === "Elicitation"
                        ? { hookSpecificOutput: { hookEventName: "Elicitation", action: "accept" } }
                        : {};
                  props.onRespond(action.id, resp);
                }}
              >
                <Check size={11} />
                Allow
              </button>
              <div class="w-px bg-suspicious/20" />
              <button
                class="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold uppercase text-attack hover:bg-attack/10 transition-colors"
                onClick={() => {
                  const resp =
                    eventName() === "PermissionRequest"
                      ? { hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "deny" } } }
                      : eventName() === "Elicitation"
                        ? { hookSpecificOutput: { hookEventName: "Elicitation", action: "decline" } }
                        : {};
                  props.onRespond(action.id, resp);
                }}
              >
                <X size={11} />
                Deny
              </button>
            </div>
          </div>
        );
      }}
    </For>
  );
}

// ── AskUserQuestion Batch ──────────────────────────────────────────

function QuestionBatchBlock(props: { events: MonitorEvent[]; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = createSignal(props.defaultExpanded);
  const count = () => props.events.length;
  const answered = () => props.events.filter((e) => e.hook_event_name === "PostToolUse").length;
  const pending = () => count() - answered();

  return (
    <div class="border-b border-panel-border/30 event-enter">
      <button
        class="flex items-center gap-2 w-full px-3 py-[7px] hover:bg-panel/20 text-left"
        onClick={() => setExpanded(!expanded())}
      >
        <span class="text-[10px] text-text-dim w-4 text-center shrink-0 font-mono leading-none">?</span>
        <span class="text-[10px] font-bold text-suspicious shrink-0 leading-none">AskUserQuestion</span>
        <span class="text-[9px] text-text-sub bg-panel-border/20 px-1 rounded-sm leading-none">{count()} questions</span>
        <Show when={pending() > 0}>
          <span class="w-1.5 h-1.5 rounded-full bg-suspicious tool-running shrink-0" />
        </Show>
        <Show when={answered() === count()}>
          <span class="text-[9px] text-safe/50 uppercase tracking-wider">done</span>
        </Show>
        <Timestamp ts={props.events[0].timestamp} class="text-[9px] text-text-sub ml-auto shrink-0" />
        <span class="text-text-sub shrink-0 ml-1">{expanded() ? <CaretDown size={9} /> : <CaretRight size={9} />}</span>
      </button>
      <div class={`tool-call-body ${expanded() ? "tool-call-expanded" : "tool-call-collapsed"}`}>
        <div class="px-3 pb-2 pl-8">
          <div class="border border-panel-border/30 rounded-sm overflow-hidden">
            <For each={props.events}>
              {(ev) => {
                const question = () => (ev.tool_input?.question as string) || "Unknown question";
                const hasAnswer = () => ev.hook_event_name === "PostToolUse";
                return (
                  <div class="flex items-center gap-2 px-2 py-1 border-b border-panel-border/10 last:border-b-0 text-[9px]">
                    <span
                      class={`w-1.5 h-1.5 rounded-full shrink-0 ${hasAnswer() ? "bg-safe" : "bg-suspicious tool-running"}`}
                    />
                    <span class="text-text-dim truncate min-w-0 flex-1">{question()}</span>
                    <span
                      class={`text-[9px] uppercase shrink-0 ${hasAnswer() ? "text-safe/50" : "text-suspicious/50"}`}
                    >
                      {hasAnswer() ? "answered" : "pending"}
                    </span>
                  </div>
                );
              }}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Tool Rate Sparkline ───────────────────────────────────────────

function Sparkline(props: { events: MonitorEvent[] }) {
  const WIDTH = 60;
  const HEIGHT = 12;
  const BUCKET_MS = 10000; // 10-second buckets

  const points = createMemo(() => {
    const events = props.events;
    if (events.length < 2) return "";
    const now = Date.now();
    const windowMs = 600000; // 10 minutes
    const start = now - windowMs;
    const buckets = new Array(Math.ceil(windowMs / BUCKET_MS)).fill(0);

    for (const ev of events) {
      if (ev.timestamp < start || !ev.tool_name) continue;
      const idx = Math.floor((ev.timestamp - start) / BUCKET_MS);
      if (idx >= 0 && idx < buckets.length) buckets[idx]++;
    }

    const max = Math.max(...buckets, 1);
    const xStep = WIDTH / (buckets.length - 1 || 1);

    return buckets
      .map((count, i) => `${(i * xStep).toFixed(1)},${(HEIGHT - (count / max) * HEIGHT).toFixed(1)}`)
      .join(" ");
  });

  const peakRate = createMemo(() => {
    const events = props.events;
    if (events.length < 2) return 0;
    const now = Date.now();
    const windowMs = 600000;
    const start = now - windowMs;
    const buckets = new Array(Math.ceil(windowMs / BUCKET_MS)).fill(0);
    for (const ev of events) {
      if (ev.timestamp < start || !ev.tool_name) continue;
      const idx = Math.floor((ev.timestamp - start) / BUCKET_MS);
      if (idx >= 0 && idx < buckets.length) buckets[idx]++;
    }
    return Math.max(...buckets) * (60 / (BUCKET_MS / 1000)); // tools/min
  });

  const color = () => {
    const rate = peakRate();
    if (rate < 1) return "var(--text-sub)";
    if (rate <= 5) return "#a3b18a";
    return "#c9a96e";
  };

  return (
    <Show when={points()}>
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        class="shrink-0"
        style={{ opacity: "0.7" }}
      >
        <polyline
          points={points()}
          fill="none"
          stroke={color()}
          stroke-width="1.2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </Show>
  );
}

// ── File Group Block ──────────────────────────────────────────────

function FileGroupBlock(props: { events: MonitorEvent[]; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = createSignal(props.defaultExpanded);
  const count = () => props.events.length;
  const filePath = () => (props.events[0]?.tool_input?.file_path as string) || "";
  const fileColor = () => hashFileColor(filePath());
  const totalDuration = () => {
    let total = 0;
    for (const ev of props.events) {
      if (ev.duration_ms) total += ev.duration_ms;
    }
    return total;
  };
  const durationLabel = () => {
    const ms = totalDuration();
    if (!ms) return null;
    if (ms < 1000) return "<1s";
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const m = Math.floor(ms / 60000);
    const s = Math.round((ms % 60000) / 1000);
    return `${m}m ${s}s`;
  };
  const opSummary = () => {
    const ops: Record<string, number> = {};
    for (const ev of props.events) {
      const name = ev.tool_name || "?";
      ops[name] = (ops[name] || 0) + 1;
    }
    return Object.entries(ops).map(([k, v]) => `${v} ${k}`).join(", ");
  };

  return (
    <div class="border-b border-panel-border/30 event-enter" style={{ position: "relative" }}>
      {/* Group header */}
      <button
        class="tool-row-grid w-full text-left hover:bg-panel/20 cursor-pointer"
        style={{
          display: "grid",
          "grid-template-columns": "6px 16px 52px 1fr auto 40px 14px",
          "align-items": "center",
          "min-height": "1.75rem",
          height: "1.75rem",
          "max-height": "1.75rem",
          padding: "0 8px 0 6px",
          overflow: "hidden",
          "white-space": "nowrap",
        }}
        onClick={() => setExpanded(!expanded())}
      >
        {/* Col 1: empty */}
        <span />
        {/* Col 2: Folder icon */}
        <span class="flex items-center justify-center">
          <Folder size={11} style={{ color: fileColor() }} />
        </span>
        {/* Col 3: op count */}
        <span class="text-[10px] font-bold text-text-label truncate leading-none">
          {count()} ops
        </span>
        {/* Col 4: file badge */}
        <span class="flex items-center gap-1 overflow-hidden pl-0.5">
          <FileBadge path={filePath()} />
        </span>
        {/* Col 5: duration */}
        <span class="flex items-center justify-end gap-1 pr-1" style={{ "max-width": "72px" }}>
          <Show when={durationLabel()}>
            <span class="text-[9px] font-mono leading-none" style={{ color: durationColor(totalDuration()) }}>
              {durationLabel()}
            </span>
          </Show>
        </span>
        {/* Col 6: timestamp of first event */}
        <Timestamp ts={props.events[0]?.timestamp} class="text-[9px] text-text-sub text-right leading-none" />
        {/* Col 7: caret */}
        <span class="flex items-center justify-center">
          {expanded() ? <CaretDown size={9} class="text-text-sub" /> : <CaretRight size={9} class="text-text-sub" />}
        </span>
      </button>
      {/* Expanded children — tree branch connectors */}
      <div class={`tool-call-body ${expanded() ? "tool-call-expanded" : "tool-call-collapsed"}`}>
        <div style={{ position: "relative", "margin-left": "17px" }}>
          <For each={props.events}>
            {(ev, i) => {
              const isLast = () => i() === props.events.length - 1;
              const branchColor = () => fileColor() + "50";
              return (
                <div style={{ position: "relative" }}>
                  {/* Vertical trunk — full height except last child stops at center */}
                  <span
                    style={{
                      position: "absolute",
                      left: "0",
                      top: "0",
                      bottom: isLast() ? "auto" : "0",
                      height: isLast() ? "0.875rem" : "auto",
                      width: "1px",
                      background: branchColor(),
                    }}
                  />
                  {/* Horizontal branch */}
                  <span
                    style={{
                      position: "absolute",
                      left: "0",
                      top: "calc(0.875rem - 0.5px)",
                      width: "10px",
                      height: "1px",
                      background: branchColor(),
                    }}
                  />
                  <div style={{ "margin-left": "14px" }}>
                    <ToolCallBlock event={ev} defaultExpanded={false} />
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </div>
    </div>
  );
}

// ── Collapsible Tool Call ───────────────────────────────────────────

function ToolCallBlock(props: { event: MonitorEvent; defaultExpanded: boolean; focused?: boolean; compact?: boolean }) {
  const [expanded, setExpanded] = createSignal(props.defaultExpanded);
  const e = () => props.event;
  const input = () => e().tool_input || {};
  const response = () => e().tool_response || {};
  const iconComp = () => TOOL_ICON_MAP[e().tool_name || ""] || Circle;
  const hasResponse = () => (e().hook_event_name === "PostToolUse" || e().hook_event_name === "PostToolUseFailure") && Object.keys(response()).length > 0;
  const isRunning = () => e().hook_event_name === "PreToolUse";
  const responseText = () => (response().content as string) || (response().output as string) || (response().result as string) || "";

  // Determine if this row has any content worth expanding
  const hasExpandableContent = () => {
    if (isRunning()) return false; // still in progress, nothing to show yet
    const name = e().tool_name || "";
    const inp = input();
    const resp = response();
    // Bash: has command or output
    if (name === "Bash") return !!(inp.command || resp.stdout || resp.output || resp.stderr);
    // Edit/Write: has diff data
    if (name === "Edit") return !!(inp.old_string || inp.new_string);
    if (name === "Write") return !!inp.content;
    // Read/Grep/Glob: has response text
    if (name === "Read" || name === "Grep" || name === "Glob") return !!responseText();
    // Agent: has prompt or result
    if (name === "Agent") return !!(inp.prompt || inp.description || responseText());
    // Generic: has any input keys or response keys
    return Object.keys(inp).length > 0 || Object.keys(resp).length > 0;
  };

  // Live elapsed + timeout detection for in-progress tools
  const [timedOut, setTimedOut] = createSignal(false);
  const [liveElapsed, setLiveElapsed] = createSignal(0);
  createEffect(() => {
    if (!isRunning()) {
      setTimedOut(false);
      setLiveElapsed(0);
      return;
    }
    const interval = setInterval(() => {
      const elapsed = Date.now() - e().timestamp;
      setLiveElapsed(elapsed);
      if (elapsed > 30000) setTimedOut(true);
    }, 1000);
    onCleanup(() => clearInterval(interval));
  });

  const liveElapsedLabel = () => {
    const ms = liveElapsed();
    if (ms < 1000) return null;
    if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
    const m = Math.floor(ms / 60000);
    const s = Math.round((ms % 60000) / 1000);
    return `${m}m ${s}s`;
  };

  const durationLabel = () => {
    const ms = e().duration_ms;
    if (!ms) return null;
    if (ms < 1000) return "<1s";
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const m = Math.floor(ms / 60000);
    const s = Math.round((ms % 60000) / 1000);
    return `${m}m ${s}s`;
  };

  const filePath = (): string | null => {
    const fp = (input().file_path as string) || null;
    return fp;
  };

  const primaryDetail = () => {
    const inp = input();
    switch (e().tool_name) {
      case "Bash":
        return (inp.command as string) || "";
      case "Read":
      case "Edit":
      case "Write":
        return null; // handled by FileBadge
      case "Grep": {
        let detail = `/${inp.pattern || ""}/`;
        if (inp.glob) detail += ` ${inp.glob}`;
        else if (inp.type) detail += ` type:${inp.type}`;
        if (inp.path) detail += ` in ${(inp.path as string).split("/").pop() || "."}`;
        return detail;
      }
      case "Glob":
        return (inp.pattern as string) || "";
      case "Agent":
        return (inp.description as string) || (inp.prompt as string)?.slice(0, 100) || "";
      default:
        return e().tool_name || "";
    }
  };

  // Bash command classification
  const cmdLabel = () => {
    if (e().tool_name !== "Bash") return null;
    return classifyCommand((input().command as string) || "");
  };

  // Diff rendering for Edit — up to 15 lines, with line numbers
  const diffLines = (): { type: "add" | "remove"; text: string; lineNo: number }[] | null => {
    if (e().tool_name !== "Edit" && e().tool_name !== "Write") return null;
    const old_s = input().old_string as string;
    const new_s = input().new_string as string;
    if (!old_s && !new_s) return null;
    const lines: { type: "add" | "remove"; text: string; lineNo: number }[] = [];
    if (old_s) {
      const oldLines = old_s.split("\n").slice(0, 15);
      for (let i = 0; i < oldLines.length; i++) lines.push({ type: "remove", text: oldLines[i], lineNo: i + 1 });
    }
    if (new_s) {
      const newLines = new_s.split("\n").slice(0, 15);
      for (let i = 0; i < newLines.length; i++) lines.push({ type: "add", text: newLines[i], lineNo: i + 1 });
    }
    return lines.length > 0 ? lines : null;
  };

  // Edit: detect replace_all flag
  const isReplaceAll = () => e().tool_name === "Edit" && input().replace_all === true;

  // Bash output
  const bashOutput = () => {
    if (e().tool_name !== "Bash") return null;
    const resp = response();
    const stdout = (resp.stdout as string) || (resp.output as string) || "";
    const stderr = (resp.stderr as string) || "";
    const exitCode = resp.exitCode ?? resp.exit_code;
    return { stdout: stdout.slice(0, 800), stderr: stderr.slice(0, 200), exitCode };
  };

  // Read info — show offset/limit if available
  const readInfo = () => {
    if (e().tool_name !== "Read") return null;
    const inp = input();
    const offset = inp.offset as number | undefined;
    const limit = inp.limit as number | undefined;
    if (offset !== undefined && limit !== undefined) return `lines ${offset + 1}-${offset + limit}`;
    if (limit !== undefined) return `${limit} lines`;
    const resp = response();
    const content = (resp.content as string) || (resp.output as string) || "";
    return content ? `${content.split("\n").length} lines` : null;
  };

  // Write line count
  const writeInfo = () => {
    if (e().tool_name !== "Write") return null;
    const content = input().content as string;
    return content ? `${content.split("\n").length} lines` : null;
  };

  // Inline summary for collapsed header
  const headerSummary = () => {
    if (e().tool_name === "Bash") return ((input().command as string) || "").slice(0, 50);
    if (e().tool_name === "Agent") return ((input().description as string) || "").slice(0, 40);
    if (e().tool_name === "Grep") return `/${input().pattern || ""}/`;
    if (e().tool_name === "Glob") return (input().pattern as string) || "";
    return null;
  };

  // Compact diff stat for Edit header (always visible)
  const editStat = () => {
    if (e().tool_name !== "Edit") return null;
    const old_s = input().old_string as string;
    const new_s = input().new_string as string;
    if (!old_s && !new_s) return null;
    const removed = old_s ? old_s.split("\n").length : 0;
    const added = new_s ? new_s.split("\n").length : 0;
    return { removed, added };
  };

  // Passive tools (observation-only) get dimmer styling
  const isPassiveTool = () => {
    const t = e().tool_name;
    return t === "Read" || t === "Grep" || t === "Glob";
  };

  // Encrypted event placeholder
  const isEncrypted = () => !!e()._encrypted && !e()._decrypt_failed;
  const isDecryptFailed = () => !!e()._decrypt_failed;

  return (
    <Show
      when={!isEncrypted() && !isDecryptFailed()}
      fallback={
        <div class="border-b border-panel-border/20 event-enter">
          <div class="flex items-center gap-1.5 w-full px-3 py-1.5">
            <Key size={11} class={isDecryptFailed() ? "text-attack/40" : "text-text-sub"} />
            <span class="text-[10px] font-bold text-text-sub shrink-0">{e().tool_name || e().hook_event_name}</span>
            <span class={`text-[9px] ${isDecryptFailed() ? "text-attack/40" : "text-text-sub"}`}>
              {isDecryptFailed() ? "[encrypted — wrong key?]" : "[encrypted]"}
            </span>
            <Timestamp ts={e().timestamp} class="text-[9px] text-text-sub ml-auto shrink-0" />
          </div>
        </div>
      }
    >
    <div class={`border-b border-panel-border/30 event-enter ${props.focused ? "ring-1 ring-safe/30" : ""}`} style={{ position: "relative" }}>
      {/* File heat map rail — 3px colored strip on left edge */}
      <Show when={filePath()}>
        <span
          style={{
            position: "absolute",
            left: "0",
            top: "0",
            bottom: "0",
            width: "3px",
            background: hashFileColor(filePath()!),
            opacity: "0.6",
            "border-radius": "0 1px 1px 0",
          }}
        />
      </Show>
      {/* Header row — CSS Grid with fixed columns for visual rhythm */}
      <button
        class={`tool-row-grid w-full text-left ${isPassiveTool() ? "opacity-60" : ""} ${isRunning() && !timedOut() ? "tool-row-shimmer" : ""} ${hasExpandableContent() ? "hover:bg-panel/20 cursor-pointer" : "cursor-default"}`}
        style={{
          display: "grid",
          "grid-template-columns": props.compact ? "6px 14px 52px 1fr 42px 12px" : "6px 16px 52px 1fr auto 40px 14px",
          "align-items": "center",
          "min-height": props.compact ? "1.375rem" : "1.75rem",
          height: props.compact ? "1.375rem" : "1.75rem",
          "max-height": props.compact ? "1.375rem" : "1.75rem",
          padding: "0 8px 0 6px",
          overflow: "hidden",
          "white-space": "nowrap",
        }}
        onClick={() => hasExpandableContent() && setExpanded(!expanded())}
      >
        {/* Col 1: Status dot */}
        <span class="flex items-center justify-center">
          <Show when={isRunning() && !timedOut()}>
            <span class="w-[5px] h-[5px] rounded-full bg-safe tool-running" />
          </Show>
          <Show when={isRunning() && timedOut()}>
            <span class="w-[5px] h-[5px] rounded-full bg-suspicious" />
          </Show>
          <Show when={!isRunning() && bashOutput()?.exitCode != null && bashOutput()!.exitCode !== 0}>
            <span class="w-[5px] h-[5px] rounded-full bg-attack" />
          </Show>
          <Show when={!isRunning() && hasResponse() && !(bashOutput()?.exitCode != null && bashOutput()!.exitCode !== 0)}>
            <span class="w-[5px] h-[5px] rounded-full bg-safe/25" />
          </Show>
        </span>

        {/* Col 2: Tool icon (colored by tool type) */}
        <span class="flex items-center justify-center">
          <Dynamic component={iconComp()} size={11} style={{ color: TOOL_COLORS[e().tool_name || ""] || "#6b6560" }} />
        </span>

        {/* Col 3: Tool name */}
        <span class="text-[10px] font-bold text-text-label truncate leading-none">
          {e().tool_name || e().hook_event_name}
        </span>

        {/* Col 4: Content (variable per tool type, single line, truncated) */}
        <span class="flex items-center gap-1 overflow-hidden pl-0.5">
          <Show when={cmdLabel()}>
            {(cl) => (
              <span class="text-[9px] font-bold uppercase px-1 rounded-sm shrink-0 leading-none"
                style={{ color: cl().color, background: cl().color + "18" }}>{cl().label}</span>
            )}
          </Show>
          <Show when={filePath()}>
            <FileBadge path={filePath()!} />
          </Show>
          <Show when={isReplaceAll()}>
            <span class="text-[9px] text-suspicious bg-suspicious/10 px-1 rounded-sm shrink-0 leading-none">all</span>
          </Show>
          <Show when={editStat()}>
            {(stat) => (
              <span class="text-[9px] font-mono shrink-0 leading-none">
                <span class="text-safe">+{stat().added}</span> <span class="text-attack">-{stat().removed}</span>
              </span>
            )}
          </Show>
          <Show when={!filePath() && headerSummary()}>
            <span class="text-[9px] text-text-dim truncate font-mono leading-none">{headerSummary()}</span>
          </Show>
        </span>

        {/* Col 5: Meta (hidden in compact mode — no column allocated) */}
        <Show when={!props.compact}>
        <span class="flex items-center justify-end gap-1 pr-1" style={{ "max-width": "72px" }}>
          <Show when={bashOutput()?.exitCode != null && bashOutput()!.exitCode !== 0}>
            <span class="text-[9px] font-bold text-attack bg-attack/15 px-1 rounded-sm leading-none">
              exit {String(bashOutput()!.exitCode)}
            </span>
          </Show>
          <Show when={!(bashOutput()?.exitCode != null && bashOutput()!.exitCode !== 0) && isRunning() && liveElapsedLabel()}>
            <span class="text-[9px] font-mono leading-none" style={{ color: timedOut() ? "#c9a96e" : "var(--text-sub)" }}>
              {liveElapsedLabel()}
            </span>
          </Show>
          <Show when={!(bashOutput()?.exitCode != null && bashOutput()!.exitCode !== 0) && !isRunning() && durationLabel()}>
            <span class={`text-[9px] font-mono leading-none ${durationBold(e().duration_ms) ? "font-bold" : ""}`}
              style={{ color: durationColor(e().duration_ms) }}>
              {durationLabel()}
            </span>
          </Show>
          <Show when={!(bashOutput()?.exitCode != null && bashOutput()!.exitCode !== 0) && !isRunning() && !durationLabel() && (readInfo() || writeInfo())}>
            <span class="text-[9px] text-text-sub leading-none">{readInfo() || writeInfo()}</span>
          </Show>
        </span>
        </Show>

        {/* Col 6: Timestamp (or Col 5 in compact) */}
        <Timestamp ts={e().timestamp} class="text-[9px] text-text-sub text-right leading-none" />

        {/* Col 7: Caret */}
        <span class="flex items-center justify-center">
          <Show when={hasExpandableContent()}>
            {expanded() ? <CaretDown size={9} class="text-text-sub" /> : <CaretRight size={9} class="text-text-sub" />}
          </Show>
        </span>
      </button>

      {/* Body — collapsible, aligned to content zone start */}
      <div class={`tool-call-body ${expanded() ? "tool-call-expanded" : "tool-call-collapsed"}`}>
        <div class="px-3 pt-2 pb-2" style={{ "padding-left": "68px" }}>
          {/* Bash command (full, when expanded) */}
          <Show when={primaryDetail() && e().tool_name === "Bash"}>
            <div class="text-[10px] text-text-dim font-mono mb-1">
              <span class="text-text-sub">$ </span>
              {primaryDetail()}
            </div>
          </Show>

          {/* Non-bash detail */}
          <Show when={primaryDetail() && e().tool_name !== "Bash"}>
            <div class="text-[10px] text-text-dim font-mono mb-1">{primaryDetail()}</div>
          </Show>

          {/* Bash output — only render if there's actual content */}
          <Show when={bashOutput()}>
            {(bo) => (
              <Show when={bo().stdout || bo().stderr}>
                <div class="terminal-block mt-1">
                  <Show when={bo().stdout}>
                    <span class="text-text-dim">{bo().stdout}</span>
                  </Show>
                  <Show when={bo().stderr}>
                    <span class="text-attack">{bo().stderr}</span>
                  </Show>
                </div>
              </Show>
            )}
          </Show>

          {/* Diff block for Edit — with line numbers */}
          <Show when={diffLines()}>
            {(lines) => (
              <div class="mt-1 rounded-sm overflow-hidden border border-panel-border/30 text-[10px] font-mono leading-4">
                <For each={lines()}>
                  {(line) => (
                    <div class={`flex ${line.type === "add" ? "diff-add" : "diff-remove"}`}>
                      <span class="w-7 text-right pr-1.5 text-text-sub/40 select-none shrink-0">{line.lineNo}</span>
                      <span>
                        {line.type === "add" ? "+" : "-"} {line.text}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            )}
          </Show>

          {/* Read: show file content preview from response */}
          <Show when={e().tool_name === "Read" && hasResponse()}>
            {(() => {
              const content = () => responseText();
              const lines = () => content().split("\n").slice(0, 20);
              const totalLines = () => content().split("\n").length;
              return (
                <Show when={content()}>
                  <div class="terminal-block mt-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-[8px] text-text-sub uppercase tracking-wider">Content</span>
                      <span class="text-[8px] text-text-dim">{totalLines()} lines</span>
                    </div>
                    <For each={lines()}>
                      {(line) => <div class="text-text-dim truncate">{line || "\u00a0"}</div>}
                    </For>
                    <Show when={totalLines() > 20}>
                      <div class="text-text-sub mt-1">... {totalLines() - 20} more lines</div>
                    </Show>
                  </div>
                </Show>
              );
            })()}
          </Show>

          {/* Grep: show matched files/lines from response */}
          <Show when={e().tool_name === "Grep" && hasResponse()}>
            {(() => {
              const output = () => responseText();
              const allLines = createMemo(() => output().split("\n").filter(Boolean));
              const visibleLines = () => allLines().slice(0, 25);
              return (
                <Show when={output()}>
                  <div class="terminal-block mt-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-[8px] text-text-sub uppercase tracking-wider">Matches</span>
                      <span class="text-[8px] text-text-dim">{allLines().length} results</span>
                    </div>
                    <For each={visibleLines()}>
                      {(line) => <div class="text-text-dim truncate">{line}</div>}
                    </For>
                    <Show when={allLines().length > 25}>
                      <div class="text-text-sub mt-1">... more results</div>
                    </Show>
                  </div>
                </Show>
              );
            })()}
          </Show>

          {/* Glob: show matched file list from response */}
          <Show when={e().tool_name === "Glob" && hasResponse()}>
            {(() => {
              const output = () => responseText();
              const allFiles = createMemo(() => output().split("\n").filter(Boolean));
              const visibleFiles = () => allFiles().slice(0, 20);
              return (
                <Show when={output()}>
                  <div class="terminal-block mt-1">
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-[8px] text-text-sub uppercase tracking-wider">Files</span>
                      <span class="text-[8px] text-text-dim">{allFiles().length} matched</span>
                    </div>
                    <For each={visibleFiles()}>
                      {(file) => (
                        <div class="text-text-dim truncate">
                          <span class="text-text-sub">{file.split("/").slice(0, -1).join("/")}/</span>
                          <span class="text-text-label">{file.split("/").pop()}</span>
                        </div>
                      )}
                    </For>
                    <Show when={allFiles().length > 20}>
                      <div class="text-text-sub mt-1">... {allFiles().length - 20} more files</div>
                    </Show>
                  </div>
                </Show>
              );
            })()}
          </Show>

          {/* Agent: show prompt + result */}
          <Show when={e().tool_name === "Agent"}>
            {(() => {
              const prompt = () => (input().prompt as string) || "";
              const agentType = () => (input().subagent_type as string) || (input().type as string) || "";
              const result = () => responseText();
              return (
                <>
                  <Show when={agentType()}>
                    <div class="flex items-center gap-2 mb-1">
                      <span class="text-[8px] font-bold uppercase tracking-wider" style={{ color: agentColor(agentType()) }}>
                        {agentType()}
                      </span>
                      <Show when={input().model}>
                        <span class="text-[8px] text-text-dim">{input().model as string}</span>
                      </Show>
                    </div>
                  </Show>
                  <Show when={prompt()}>
                    <div class="terminal-block mt-1 mb-1">
                      <span class="text-[8px] text-text-sub uppercase tracking-wider">Prompt</span>
                      <div class="text-text-dim mt-0.5 whitespace-pre-wrap text-[9px] max-h-[120px] overflow-y-auto">{prompt().slice(0, 500)}</div>
                    </div>
                  </Show>
                  <Show when={result()}>
                    <div class="terminal-block mt-1">
                      <span class="text-[8px] text-text-sub uppercase tracking-wider">Result</span>
                      <div class="text-text-dim mt-0.5 whitespace-pre-wrap text-[9px] max-h-[200px] overflow-y-auto">{result().slice(0, 800)}</div>
                    </div>
                  </Show>
                </>
              );
            })()}
          </Show>

          {/* Generic fallback: show tool_input keys for unknown tools */}
          <Show when={!["Bash", "Edit", "Write", "Read", "Grep", "Glob", "Agent"].includes(e().tool_name || "") && Object.keys(input()).length > 0}>
            <div class="terminal-block mt-1">
              <span class="text-[8px] text-text-sub uppercase tracking-wider">Input</span>
              <For each={Object.entries(input()).slice(0, 10)}>
                {([key, val]) => (
                  <div class="text-text-dim truncate mt-0.5">
                    <span class="text-text-label">{key}:</span>{" "}
                    <span>{typeof val === "string" ? val.slice(0, 200) : JSON.stringify(val).slice(0, 200)}</span>
                  </div>
                )}
              </For>
            </div>
          </Show>

          {/* Generic response for non-Bash tools that have response data but no specific renderer */}
          <Show when={!["Bash", "Edit", "Write", "Read", "Grep", "Glob", "Agent"].includes(e().tool_name || "") && hasResponse() && Object.keys(response()).length > 0}>
            <div class="terminal-block mt-1">
              <span class="text-[8px] text-text-sub uppercase tracking-wider">Output</span>
              <For each={Object.entries(response()).slice(0, 10)}>
                {([key, val]) => (
                  <div class="text-text-dim truncate mt-0.5">
                    <span class="text-text-label">{key}:</span>{" "}
                    <span>{typeof val === "string" ? val.slice(0, 300) : JSON.stringify(val).slice(0, 300)}</span>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>
      </div>
    </div>
    </Show>
  );
}

// ── Main Session Detail Panel ───────────────────────────────────────

export const SessionDetail: Component<{
  session: SessionState;
  onClose: () => void;
  isMobile?: boolean;
  showClose?: boolean;
  pendingActions?: Record<string, PendingAction>;
  onActionRespond?: (actionId: string, hookResponse: Record<string, unknown>) => void;
  onRequestHistory?: (sessionId: string) => void;
  historyLoading?: boolean;
}> = (props) => {
  const s = () => props.session;
  let scrollRef: HTMLDivElement | undefined;
  const [autoScroll, setAutoScroll] = createSignal(true);
  const [duration, setDuration] = createSignal(formatDuration(s().started_at));
  const [compactMode, setCompactMode] = createSignal(false);

  // Auto-update duration
  const timer = setInterval(() => setDuration(formatDuration(s().started_at)), 5000);
  onCleanup(() => clearInterval(timer));

  // Events sorted chronologically, with agent_id for nesting
  // Merges PreToolUse + PostToolUse by tool_use_id into a single event
  const timeline = createMemo(() => {
    const filtered = s()
      .events.filter(
        (e) =>
          e.tool_name ||
          e.hook_event_name === "Stop" ||
          e.hook_event_name === "StopFailure" ||
          e.hook_event_name === "SessionStart" ||
          e.hook_event_name === "SessionEnd" ||
          e.hook_event_name === "Notification" ||
          e.hook_event_name === "PostToolUseFailure" ||
          e.hook_event_name === "PreCompact" ||
          e.hook_event_name === "PostCompact" ||
          e.hook_event_name === "PermissionRequest" ||
          e.hook_event_name === "PermissionDenied" ||
          e.hook_event_name === "SubagentStart" ||
          e.hook_event_name === "SubagentStop" ||
          e.hook_event_name === "UserPromptSubmit",
      )
      .sort((a, b) => a.timestamp - b.timestamp);

    // Pass 1: Deduplicate identical events (3x hook registration bug)
    // Key: tool_use_id+hook_event_name for tool events, timestamp+hook_event_name+prompt_hash for others
    const seen = new Set<string>();
    const deduped: MonitorEvent[] = [];
    for (const e of filtered) {
      let key: string;
      if (e.tool_use_id) {
        key = `${e.tool_use_id}:${e.hook_event_name}`;
      } else {
        // For non-tool events, use timestamp + event name + first 40 chars of distinguishing content
        const content = e.prompt || e.last_assistant_message || e.compact_summary || e.agent_id || "";
        key = `${e.timestamp}:${e.hook_event_name}:${(typeof content === "string" ? content : "").slice(0, 40)}`;
      }
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(e);
    }

    // Pass 2: Merge PreToolUse + PostToolUse by tool_use_id into single events
    const mergedByToolUseId = new Map<string, number>(); // tool_use_id → index in result
    const result: MonitorEvent[] = [];
    for (const e of deduped) {
      const tuid = e.tool_use_id;
      if (tuid && e.hook_event_name === "PreToolUse") {
        mergedByToolUseId.set(tuid, result.length);
        result.push(e);
      } else if (tuid && (e.hook_event_name === "PostToolUse" || e.hook_event_name === "PostToolUseFailure") && mergedByToolUseId.has(tuid)) {
        const idx = mergedByToolUseId.get(tuid)!;
        const pre = result[idx];
        result[idx] = {
          ...pre,
          hook_event_name: e.hook_event_name === "PostToolUseFailure" ? "PostToolUseFailure" : "PostToolUse",
          tool_response: e.tool_response,
          duration_ms: e.duration_ms,
          error: e.error,
          error_details: e.error_details,
        };
      } else {
        result.push(e);
      }
    }
    return result;
  });

  // Build agent nesting: track which agent_ids have active SubagentStart blocks
  const agentBlocks = createMemo(() => {
    const blocks = new Map<string, { type: string; startIdx: number; stopIdx: number; childIndices: number[] }>();
    const events = timeline();
    // Pass 1: find SubagentStart/Stop pairs
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.hook_event_name === "SubagentStart" && e.agent_id) {
        blocks.set(e.agent_id, { type: e.agent_type || "agent", startIdx: i, stopIdx: -1, childIndices: [] });
      }
      if (e.hook_event_name === "SubagentStop" && e.agent_id && blocks.has(e.agent_id)) {
        blocks.get(e.agent_id)!.stopIdx = i;
      }
    }
    // Pass 2: assign child events to their agent block
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (
        e.agent_id &&
        e.hook_event_name !== "SubagentStart" &&
        e.hook_event_name !== "SubagentStop" &&
        blocks.has(e.agent_id)
      ) {
        blocks.get(e.agent_id)!.childIndices.push(i);
      }
    }
    return blocks;
  });

  // Set of event indices that are nested inside an agent block (skip at top level)
  // Hide child events and SubagentStop from main timeline — but NOT SubagentStart
  // SubagentStart renders inline at its chronological position with nested children
  const nestedIndices = createMemo(() => {
    const set = new Set<number>();
    for (const block of agentBlocks().values()) {
      if (block.stopIdx >= 0) set.add(block.stopIdx);
      for (const idx of block.childIndices) set.add(idx);
    }
    return set;
  });

  // Detect consecutive AskUserQuestion events within 2s for batch display
  const questionBatches = createMemo(() => {
    const events = timeline();
    const batches = new Map<number, number[]>();
    let currentBatch: number[] = [];
    let lastTs = 0;
    for (let i = 0; i < events.length; i++) {
      const ev = events[i];
      if (nestedIndices().has(i)) continue;
      if (ev.tool_name === "AskUserQuestion") {
        if (currentBatch.length === 0 || ev.timestamp - lastTs <= 2000) {
          currentBatch.push(i);
          lastTs = ev.timestamp;
        } else {
          if (currentBatch.length >= 2) batches.set(currentBatch[0], [...currentBatch]);
          currentBatch = [i];
          lastTs = ev.timestamp;
        }
      } else {
        if (currentBatch.length >= 2) batches.set(currentBatch[0], [...currentBatch]);
        currentBatch = [];
        lastTs = 0;
      }
    }
    if (currentBatch.length >= 2) batches.set(currentBatch[0], [...currentBatch]);
    return batches;
  });

  const batchedIndices = createMemo(() => {
    const set = new Set<number>();
    for (const indices of questionBatches().values()) {
      for (let j = 1; j < indices.length; j++) set.add(indices[j]);
    }
    return set;
  });

  // File grouping: consecutive same-file_path events (2+ in a row)
  const fileGroups = createMemo(() => {
    const groups = new Map<number, number[]>(); // first index → [indices...]
    const events = timeline();
    let currentFile = "";
    let currentGroup: number[] = [];

    const flushGroup = () => {
      if (currentGroup.length >= 2) {
        groups.set(currentGroup[0], [...currentGroup]);
      }
      currentGroup = [];
      currentFile = "";
    };

    for (let i = 0; i < events.length; i++) {
      if (nestedIndices().has(i) || batchedIndices().has(i)) continue;
      const ev = events[i];
      const fp = (ev.tool_input?.file_path as string) || "";
      if (fp && fp === currentFile) {
        currentGroup.push(i);
      } else {
        flushGroup();
        if (fp) {
          currentFile = fp;
          currentGroup = [i];
        }
      }
    }
    flushGroup();
    return groups;
  });

  // Set of indices that are non-first members of a file group (skip in main loop)
  const fileGroupedIndices = createMemo(() => {
    const set = new Set<number>();
    for (const indices of fileGroups().values()) {
      for (let j = 1; j < indices.length; j++) set.add(indices[j]);
    }
    return set;
  });

  // Gap detection: find indices where time gap > 60s from previous visible event
  const gapsBefore = createMemo(() => {
    const gaps = new Map<number, number>(); // index → gap in ms
    const events = timeline();
    let prevTs = 0;
    for (let i = 0; i < events.length; i++) {
      if (nestedIndices().has(i) || batchedIndices().has(i)) continue;
      if (prevTs > 0) {
        const gap = events[i].timestamp - prevTs;
        if (gap > 60000) gaps.set(i, gap);
      }
      prevTs = events[i].timestamp;
    }
    return gaps;
  });

  // Error chain: indices of events following a Bash failure (up to 3 events after)
  const errorChainIndices = createMemo(() => {
    const set = new Set<number>();
    const events = timeline();
    let failChainEnd = -1;
    for (let i = 0; i < events.length; i++) {
      if (nestedIndices().has(i)) continue;
      const ev = events[i];
      // Detect Bash failure
      if (ev.tool_name === "Bash") {
        const resp = ev.tool_response || {};
        const exitCode = resp.exitCode ?? resp.exit_code;
        if (exitCode != null && exitCode !== 0) {
          failChainEnd = i + 3;
        }
      }
      // Mark events in the chain (but not the failed Bash itself)
      if (i > 0 && i <= failChainEnd && !(ev.tool_name === "Bash" && ((ev.tool_response || {}).exitCode ?? (ev.tool_response || {}).exit_code) !== 0)) {
        set.add(i);
      }
    }
    return set;
  });

  // Per-agent open/close state — persists across agentBlocks() recomputation
  const [agentOpenState, setAgentOpenState] = createSignal<Map<string, boolean>>(new Map());
  const getAgentOpen = (agentId: string, defaultOpen: boolean) => {
    const map = agentOpenState();
    return map.has(agentId) ? map.get(agentId)! : defaultOpen;
  };
  const toggleAgentOpen = (agentId: string) => {
    const map = new Map(agentOpenState());
    map.set(agentId, !getAgentOpen(agentId, true));
    setAgentOpenState(map);
  };

  // Auto-enable compact mode at 100+ events
  createEffect(() => {
    if (timeline().length >= 100 && !compactMode()) setCompactMode(true);
  });

  // Track new messages when scrolled up
  const [newMessageCount, setNewMessageCount] = createSignal(0);
  let prevTimelineLen = 0;

  // Auto-scroll to bottom on new events — smooth animation so items "pop in" from bottom
  createEffect(() => {
    const len = timeline().length;
    const delta = len - prevTimelineLen;
    prevTimelineLen = len;
    if (delta <= 0) return;
    if (autoScroll() && scrollRef) {
      requestAnimationFrame(() => {
        scrollRef!.scrollTo({ top: scrollRef!.scrollHeight, behavior: "smooth" });
      });
    } else if (delta > 0) {
      setNewMessageCount((c) => c + delta);
    }
  });

  const handleScroll = () => {
    if (!scrollRef) return;
    const atBottom = scrollRef.scrollHeight - scrollRef.scrollTop - scrollRef.clientHeight < 50;
    setAutoScroll(atBottom);
    if (atBottom) setNewMessageCount(0);
  };

  // Auto-load history from IDB when session has no in-memory events
  createEffect(() => {
    if (s().events.length === 0 && props.onRequestHistory) {
      props.onRequestHistory(s().session_id);
    }
  });

  const jumpToLatest = () => {
    if (scrollRef) {
      scrollRef.scrollTo({ top: scrollRef.scrollHeight, behavior: "smooth" });
      setAutoScroll(true);
      setNewMessageCount(0);
    }
  };

  const statusColor = () => STATUS_COLORS[s().status] || "#666";
  const isWaiting = () => s().status === "waiting";

  // Keyboard navigation
  const [focusedIdx, setFocusedIdx] = createSignal(-1);

  const handleKeyDown = (ev: KeyboardEvent) => {
    const len = timeline().length;
    if (len === 0) return;
    const idx = focusedIdx();

    if (ev.key === "j" || ev.key === "ArrowDown") {
      ev.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, len - 1));
    } else if (ev.key === "k" || ev.key === "ArrowUp") {
      ev.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    } else if (ev.key === "Escape") {
      setFocusedIdx(-1);
    } else if ((ev.key === "Enter" || ev.key === " ") && idx >= 0) {
      // Toggle expand/collapse of focused row
      ev.preventDefault();
      const el = scrollRef?.querySelector(`[data-tl-idx="${idx}"] button`) as HTMLElement | null;
      el?.click();
    } else if (ev.key === "y" && idx >= 0) {
      // Copy primary content: file_path for file tools, command for Bash, pattern for Grep
      ev.preventDefault();
      const event = timeline()[idx];
      const inp = event?.tool_input || {};
      const text = (inp.file_path as string) || (inp.command as string) || (inp.pattern as string) || "";
      if (text) navigator.clipboard.writeText(text);
    } else if (ev.key === "e" && idx >= 0) {
      // Copy new_string for Edit tools
      ev.preventDefault();
      const event = timeline()[idx];
      if (event?.tool_name === "Edit") {
        const text = (event.tool_input?.new_string as string) || "";
        if (text) navigator.clipboard.writeText(text);
      }
    }
  };

  // Auto-scroll to focused event — use data attribute to find correct DOM node
  // (raw children[idx] is wrong when nestedIndices skips rows)
  createEffect(() => {
    const idx = focusedIdx();
    if (idx >= 0 && scrollRef) {
      const el = scrollRef.querySelector(`[data-tl-idx="${idx}"]`) as HTMLElement | null;
      el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  });

  // ── Tasks + Compaction — computed here, rendered as header pills ──
  const tasks = createMemo(() => {
    const byId = new Map<string, { subject: string; completed: boolean }>();
    let createCount = 0;
    for (const ev of timeline()) {
      const inp = ev.tool_input || {};
      if (ev.tool_name === "TaskCreate" && inp.subject) {
        createCount++;
        byId.set(String(createCount), { subject: inp.subject as string, completed: false });
      }
      if (ev.tool_name === "TaskUpdate" && (inp.status === "completed" || inp.status === "deleted")) {
        const taskId = inp.taskId as string;
        if (taskId && byId.has(taskId)) byId.get(taskId)!.completed = true;
      }
    }
    return [...byId.values()];
  });
  const tasksCompleted = () => tasks().filter((t) => t.completed).length;
  const tasksAllDone = () => tasks().length > 0 && tasks().every((t) => t.completed);
  const [tasksDismissed, setTasksDismissed] = createSignal(false);
  const [tasksOpen, setTasksOpen] = createSignal(false);
  const [compactionDismissed, setCompactionDismissed] = createSignal(false);
  const [compactionOpen, setCompactionOpen] = createSignal(false);

  // ── Orbit panel: subagent data for side column ──
  const hasSubagents = createMemo(() => agentBlocks().size > 0);
  const orbitEntries = createMemo(() => {
    const entries: { agentId: string; type: string; startTs: number; endTs: number | null; toolCount: number; events: typeof timeline extends () => infer T ? T : never[] }[] = [];
    const events = timeline();
    for (const [agentId, block] of agentBlocks()) {
      const childEvents = block.childIndices.map((idx) => events[idx]).filter(Boolean);
      const startEvent = events[block.startIdx];
      const stopEvent = block.stopIdx >= 0 ? events[block.stopIdx] : undefined;
      entries.push({
        agentId,
        type: block.type,
        startTs: startEvent?.timestamp || 0,
        endTs: stopEvent?.timestamp || null,
        toolCount: childEvents.length,
        events: childEvents,
      });
    }
    return entries.sort((a, b) => b.startTs - a.startTs);
  });

  return (
    <div class={`cm-content ${props.isMobile ? "w-full flex-1" : "flex-1 min-w-0"} flex flex-col overflow-hidden bg-bg`}>
      {/* Header — aligned with ACTIVITY header */}
      <div class="px-3 py-2 border-b border-panel-border flex items-center gap-2 shrink-0 h-[33px]">
        <Show when={props.showClose !== false || props.isMobile}>
          <button
            onClick={props.onClose}
            class={`text-text-sub hover:text-text-primary transition-colors ${props.isMobile ? "text-[14px] w-11 h-11 flex items-center justify-center -ml-2" : "text-[11px] w-4"}`}
          >
            x
          </button>
        </Show>
        <SessionBadge
          sessionId={s().session_id}
          projectName={s().project_name}
          status={s().status}
          showStatus={true}
          size="md"
        />
        <Show when={s().permission_mode}>
          <PermissionBadge mode={s().permission_mode!} compact={true} />
        </Show>
        <span class="ml-auto flex items-center gap-2 shrink-0">
          <Sparkline events={s().events} />
          <Show when={s().model}>
            <ModelBadge model={s().model!} />
          </Show>
        </span>
        <button
          class="text-[8px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm transition-colors shrink-0"
          style={{
            color: compactMode() ? "#a3b18a" : "var(--text-sub)",
            background: compactMode() ? "#a3b18a15" : "var(--panel-border-color, #333)",
          }}
          onClick={() => setCompactMode(!compactMode())}
          title={compactMode() ? "Switch to normal density" : "Switch to compact density"}
        >
          {compactMode() ? "dense" : "normal"}
        </button>
        {/* Tasks pill */}
        <Show when={tasks().length > 0 && !tasksDismissed()}>
          <div class="relative shrink-0">
            <button
              class="flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded-sm transition-colors"
              style={{
                color: tasksAllDone() ? "#a3b18a" : "#c9a96e",
                background: tasksAllDone() ? "#a3b18a12" : "#c9a96e12",
              }}
              onClick={() => setTasksOpen(!tasksOpen())}
            >
              {tasksCompleted()}/{tasks().length}
              <span class="uppercase" style={{ "font-size": "7px" }}>tasks</span>
            </button>
            <button
              class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-bg border border-panel-border/50 text-[7px] text-text-sub hover:text-text-primary flex items-center justify-center"
              onClick={(e) => { e.stopPropagation(); setTasksDismissed(true); }}
            >x</button>
            <Show when={tasksOpen()}>
              <div class="absolute top-full right-0 mt-1 z-50 w-[240px] max-h-[300px] overflow-y-auto rounded border border-panel-border bg-card shadow-lg p-2 space-y-0.5">
                <For each={tasks()}>
                  {(task) => (
                    <div class="flex items-center gap-1.5 text-[9px]">
                      <span class={`w-2 h-2 rounded-sm border shrink-0 flex items-center justify-center ${task.completed ? "border-safe/50 bg-safe/10" : "border-text-sub/30"}`}>
                        <Show when={task.completed}>
                          <Check size={7} class="text-safe" />
                        </Show>
                      </span>
                      <span class={task.completed ? "text-text-dim line-through" : "text-text-primary"}>
                        {task.subject}
                      </span>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </div>
        </Show>
        {/* Compaction pill */}
        <Show when={s().compact_summary && !compactionDismissed()}>
          <div class="relative shrink-0">
            <button
              class="flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded-sm text-[#7b9fbf] transition-colors"
              style={{ background: "#7b9fbf12" }}
              onClick={() => setCompactionOpen(!compactionOpen())}
            >
              <span class="uppercase" style={{ "font-size": "7px" }}>compact</span>
              x{s().compaction_count || 1}
            </button>
            <button
              class="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-bg border border-panel-border/50 text-[7px] text-text-sub hover:text-text-primary flex items-center justify-center"
              onClick={(e) => { e.stopPropagation(); setCompactionDismissed(true); }}
            >x</button>
            <Show when={compactionOpen()}>
              <div class="absolute top-full right-0 mt-1 z-50 w-[320px] max-h-[200px] overflow-y-auto rounded border border-panel-border bg-card shadow-lg p-2 text-[9px] text-text-dim">
                {s().compact_summary}
              </div>
            </Show>
          </div>
        </Show>
      </div>

      {/* Waiting banner — pinned, not scrollable */}
      <Show when={isWaiting()}>
        <div class="waiting-banner mx-2 mt-2 rounded-sm px-3 py-2">
          <div class="flex items-center gap-2">
            <span
              class="w-2.5 h-2.5 rounded-full bg-suspicious animate-pulse shrink-0"
              style={{ "box-shadow": "0 0 8px var(--suspicious)" }}
            />
            <div class="flex-1 min-w-0">
              <span class="text-[11px] font-bold text-suspicious">{s().smart_status || "Claude needs your input"}</span>
              <Show when={s().notification_message && s().notification_message !== s().smart_status}>
                <div class="text-[10px] text-text-dim mt-0.5">{s().notification_message}</div>
              </Show>
            </div>
          </div>
          <Show when={!props.isMobile}>
            <div
              class="mt-2 bg-[#0c0c0c] border border-suspicious/20 rounded px-2.5 py-1.5 font-mono text-[10px] text-suspicious/80 cursor-pointer hover:border-suspicious/40 transition-colors select-all"
              title="Click to copy resume command"
              onClick={() => navigator.clipboard.writeText(`claude --resume ${s().session_id}`)}
            >
              claude --resume {s().session_id}
            </div>
          </Show>
          <Show when={props.isMobile}>
            <div class="mt-1.5 text-[10px] text-suspicious/60">
              Resume this session from your terminal to continue.
            </div>
          </Show>
          <Show when={s().cwd && !props.isMobile}>
            <div class="text-[8px] text-text-sub mt-1">in {s().cwd}</div>
          </Show>
        </div>
      </Show>

      {/* Compaction summary moved to header pill */}

      <Show when={s().end_reason && (s().status === "done" || s().status === "offline")}>
        <div class="mx-2 mt-2 rounded-sm px-3 py-1.5 bg-panel/30 text-[10px] text-text-dim">
          Session ended: <span class="text-text-sub">{s().end_reason}</span>
        </div>
      </Show>

      {/* Action bridge — pending approvals for this session */}
      <Show when={props.pendingActions && props.onActionRespond}>
        {(() => {
          const sessionActions = () =>
            Object.values(props.pendingActions!).filter((a) => a && a.session_id === s().session_id);
          return (
            <Show when={sessionActions().length > 0}>
              <ActionBanner actions={sessionActions()} onRespond={props.onActionRespond!} />
            </Show>
          );
        })()}
      </Show>

      {/* Timeline + Orbit panel row */}
      <div class="flex flex-1 min-h-0 overflow-hidden">
      {/* Scrollable tool call timeline — j/k keyboard nav */}
      <div
        ref={scrollRef}
        class="flex-1 overflow-y-auto smooth-scroll relative outline-none"
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        <For each={timeline()}>
          {(event, i) => (
            <Show when={!nestedIndices().has(i()) && !batchedIndices().has(i()) && !fileGroupedIndices().has(i())}>
              {/* Gap marker — visual break for 60s+ gaps */}
              <Show when={gapsBefore().has(i())}>
                <div
                  class="flex items-center justify-center py-1"
                  style={{
                    "border-top": "1px dashed var(--panel-border)",
                    "border-bottom": "1px dashed var(--panel-border)",
                    margin: "2px 0",
                  }}
                >
                  <span class="text-[8px] text-text-sub/40 font-mono tracking-wider">
                    ··· {formatGapDuration(gapsBefore().get(i())!)} gap ···
                  </span>
                </div>
              </Show>
              <div data-tl-idx={i()} class={errorChainIndices().has(i()) ? "bg-attack/5" : ""}>
                <Show
                  when={event.tool_name}
                  fallback={
                    <>
                      {/* ── UserPromptSubmit: conversation separator ──────────── */}
                      <Show when={event.hook_event_name === "UserPromptSubmit" && event.prompt}>
                        {(() => {
                          const [open, setOpen] = createSignal(false);
                          const text = event.prompt!;
                          const firstLine = text.split("\n")[0]?.trim() || text.slice(0, 80);
                          const isSlashCmd = text.startsWith("/");
                          const hasMore = text.length > 120 || text.includes("\n");
                          return (
                            <div class="border-l-3 border-l-[#8a8478] bg-[#1a1916]">
                              <button
                                class="flex items-center gap-2 w-full px-3 hover:bg-[#8a847810] text-left"
                                style={{ "min-height": "1.75rem", padding: "4px 12px" }}
                                onClick={() => hasMore && setOpen(!open())}
                              >
                                <span class="text-[10px] text-[#8a8478] font-bold shrink-0 leading-none">you</span>
                                <Show when={isSlashCmd}>
                                  <span class="text-[8px] font-mono font-bold text-safe bg-safe/10 px-1 rounded-sm shrink-0">
                                    {text.split(/\s/)[0]}
                                  </span>
                                </Show>
                                <span class="text-[10px] text-text-primary min-w-0 truncate leading-none">
                                  <Show when={!open()}>
                                    <span class="truncate">
                                      {isSlashCmd ? text.slice(text.indexOf(" ") + 1) : text.split("\n")[0]}
                                    </span>
                                  </Show>
                                  <Show when={open()}>
                                    <span class="whitespace-pre-wrap break-words">{text}</span>
                                  </Show>
                                </span>
                                <Show when={hasMore}>
                                  <span class="text-text-sub shrink-0 ml-auto leading-none">
                                    {open() ? <CaretDown size={9} /> : <CaretRight size={9} />}
                                  </span>
                                </Show>
                              </button>
                            </div>
                          );
                        })()}
                      </Show>

                      {/* ── Stop: Claude's response card ─────────────────────── */}
                      <Show when={event.hook_event_name === "Stop"}>
                        {(() => {
                          const [open, setOpen] = createSignal(false);
                          const text = event.last_assistant_message || "";
                          const hasText = text.length > 0;
                          const firstLine =
                            text
                              .split("\n")
                              .find((l) => l.trim() && !l.startsWith("#") && !l.startsWith("-") && !l.startsWith("*"))
                              ?.trim()
                              ?.replace(/\*\*/g, "")
                              ?.slice(0, 120) || "";
                          return (
                            <div class="border-l-3 border-l-safe/40 bg-[#161412]">
                              <button
                                class="flex items-center gap-2 w-full px-3 hover:bg-safe/8 text-left"
                                style={{ "min-height": "1.75rem", padding: "4px 12px" }}
                                onClick={() => hasText && setOpen(!open())}
                              >
                                <span class="text-[10px] text-safe font-bold shrink-0 leading-none">Claude</span>
                                <Show when={event.stop_hook_active}>
                                  <span class="text-[9px] font-bold text-suspicious bg-suspicious/10 px-1 rounded-sm uppercase shrink-0 leading-none">
                                    verifying
                                  </span>
                                </Show>
                                <Show when={hasText && !open()}>
                                  <span class="text-[9px] text-text-dim truncate min-w-0 leading-none">
                                    {firstLine}
                                    {text.length > 120 ? "..." : ""}
                                  </span>
                                </Show>
                                <Show when={!hasText}>
                                  <span class="text-[9px] text-text-sub italic leading-none">Done</span>
                                </Show>
                                <Timestamp ts={event.timestamp} class="text-[9px] text-text-sub ml-auto shrink-0" />
                                <Show when={hasText}>
                                  <span class="text-text-sub shrink-0">
                                    {open() ? <CaretDown size={9} /> : <CaretRight size={9} />}
                                  </span>
                                </Show>
                              </button>
                              <div class={`tool-call-body ${open() ? "tool-call-expanded" : "tool-call-collapsed"}`}>
                                <div class="px-3 pb-3 pl-3 max-h-[400px] overflow-y-auto">
                                  <MarkdownBlock text={text} maxLength={4000} />
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </Show>

                      {/* ── StopFailure: error card ──────────────────────────── */}
                      <Show when={event.hook_event_name === "StopFailure"}>
                        <div class="border-l-2 border-l-attack bg-attack/5 px-3" style={{ "min-height": "1.75rem", padding: "4px 12px" }}>
                          <div class="flex items-center gap-2">
                            <span class="text-[10px] font-bold text-attack">Error</span>
                            <span class="text-[9px] text-attack/80 truncate">
                              {(event.error as string) || "API error"}
                            </span>
                            <CopyContextBtn session={s()} event={event} />
                            <Timestamp ts={event.timestamp} class="text-[9px] text-text-sub ml-auto shrink-0" />
                          </div>
                          <Show when={event.error_details}>
                            <div class="text-[9px] text-text-dim mt-1 font-mono">{event.error_details}</div>
                          </Show>
                        </div>
                      </Show>

                      {/* ── SessionStart: banner ──────────────────────────────── */}
                      <Show when={event.hook_event_name === "SessionStart"}>
                        <div class="border-b border-safe/20 bg-safe/5 flex items-center gap-2" style={{ "min-height": "1.75rem", padding: "4px 12px" }}>
                          <span class="text-[10px] font-bold text-safe">
                            Session{" "}
                            {event.source === "resume"
                              ? "resumed"
                              : event.source === "clear"
                                ? "cleared"
                                : event.source === "compact"
                                  ? "restarted"
                                  : "started"}
                          </span>
                          <Show when={event.model}>
                            <ModelBadge model={event.model!} />
                          </Show>
                          <Show when={event.permission_mode && event.permission_mode !== "default"}>
                            <PermissionBadge mode={event.permission_mode!} compact={true} />
                          </Show>
                          <Timestamp ts={event.timestamp} class="text-[9px] text-text-sub ml-auto shrink-0" />
                        </div>
                      </Show>

                      {/* ── SubagentStart: inline at chronological position ──── */}
                      <Show when={event.hook_event_name === "SubagentStart" && event.agent_id}>
                        {(() => {
                          const agentId = event.agent_id!;
                          const block = () => agentBlocks().get(agentId);
                          const isDone = () => block()?.stopIdx !== undefined && block()!.stopIdx >= 0;
                          const isOpen = () => getAgentOpen(agentId, !isDone());
                          const childEvents = () =>
                            (block()?.childIndices || []).map((idx) => timeline()[idx]).filter(Boolean);
                          const stopEvent = () => {
                            const b = block();
                            return b && b.stopIdx >= 0 ? timeline()[b.stopIdx] : undefined;
                          };
                          const agentDuration = () => {
                            const stop = stopEvent();
                            if (!stop) return null;
                            const ms = stop.timestamp - event.timestamp;
                            if (ms < 1000) return "<1s";
                            if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
                            const m = Math.floor(ms / 60000);
                            const s = Math.round((ms % 60000) / 1000);
                            return `${m}m ${s}s`;
                          };
                          return (
                            <div class="border-l-2 border-l-[#b07bac]/40 bg-[#b07bac08]">
                              <button
                                class="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-[#b07bac10] text-left"
                                onClick={() => toggleAgentOpen(agentId)}
                              >
                                <span
                                  class="text-[9px] font-bold"
                                  style={{ color: agentColor(event.agent_type || "") }}
                                >
                                  @
                                </span>
                                <span
                                  class="text-[9px] font-mono font-bold px-1 rounded-sm"
                                  style={{
                                    color: agentColor(event.agent_type || ""),
                                    background: agentColor(event.agent_type || "") + "18",
                                  }}
                                >
                                  {event.agent_type || "general-purpose"}
                                </span>
                                <Show when={!isDone()}>
                                  <span class="w-1.5 h-1.5 rounded-full bg-[#b07bac] tool-running shrink-0" />
                                </Show>
                                <Show when={isDone()}>
                                  <span class="text-[9px] text-[#b07bac]/50 uppercase">done</span>
                                </Show>
                                <Show when={childEvents().length > 0}>
                                  <span class="text-[9px] text-text-sub">{childEvents().length} tools</span>
                                </Show>
                                <Show when={agentDuration()}>
                                  <span class="text-[9px] text-text-sub font-mono">{agentDuration()}</span>
                                </Show>
                                <Timestamp ts={event.timestamp} class="text-[9px] text-text-sub ml-auto shrink-0" />
                                <span class="text-text-sub shrink-0">
                                  {isOpen() ? <CaretDown size={9} /> : <CaretRight size={9} />}
                                </span>
                              </button>
                              <div class={`tool-call-body ${isOpen() ? "tool-call-expanded" : "tool-call-collapsed"}`}>
                                <div class="ml-3 border-l border-[#b07bac]/20">
                                  <For each={childEvents()}>
                                    {(childEvent) => (
                                      <Show
                                        when={childEvent.tool_name}
                                        fallback={
                                          <div class="border-b border-panel-border/10 px-3 py-1 flex items-center gap-2">
                                            <span class="text-[9px] text-text-sub">{childEvent.hook_event_name}</span>
                                            <Timestamp
                                              ts={childEvent.timestamp}
                                              class="text-[9px] text-text-sub ml-auto"
                                            />
                                          </div>
                                        }
                                      >
                                        <ToolCallBlock event={childEvent} defaultExpanded={false} compact={compactMode()} />
                                      </Show>
                                    )}
                                  </For>
                                  <Show when={stopEvent()?.last_assistant_message}>
                                    {(() => {
                                      const [resultOpen, setResultOpen] = createSignal(false);
                                      const text = stopEvent()!.last_assistant_message!;
                                      return (
                                        <div class="border-t border-[#b07bac]/20">
                                          <button
                                            class="flex items-center gap-2 w-full px-3 py-1 hover:bg-[#b07bac08] text-left"
                                            onClick={() => setResultOpen(!resultOpen())}
                                          >
                                            <span class="text-[9px] font-bold text-[#b07bac]/60">Result</span>
                                            <span class="text-[9px] text-text-dim truncate">{text.slice(0, 60)}</span>
                                            <span class="text-text-sub shrink-0 ml-auto">
                                              {resultOpen() ? <CaretDown size={8} /> : <CaretRight size={8} />}
                                            </span>
                                          </button>
                                          <div
                                            class={`tool-call-body ${resultOpen() ? "tool-call-expanded" : "tool-call-collapsed"}`}
                                          >
                                            <div class="px-3 pb-2 max-h-[200px] overflow-y-auto">
                                              <MarkdownBlock text={text} maxLength={2000} />
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </Show>
                                </div>
                              </div>
                            </div>
                          );
                        })()}
                      </Show>

                      {/* ── PreCompact: still loading ─────────────────────────── */}
                      <Show when={event.hook_event_name === "PreCompact"}>
                        <div class="flex items-center gap-2 px-3 py-1.5 bg-[#7b9fbf08]">
                          <span class="text-[9px] font-bold text-[#7b9fbf]">Compacting...</span>
                          <Timestamp ts={event.timestamp} class="text-[9px] text-text-sub ml-auto shrink-0" />
                        </div>
                      </Show>

                      {/* ── PostCompact: watermark divider ─────────────────────── */}
                      <Show when={event.hook_event_name === "PostCompact"}>
                        {(() => {
                          const [open, setOpen] = createSignal(false);
                          const summary = event.compact_summary;
                          return (
                            <>
                              <div
                                class="flex items-center gap-3 py-2 my-1 cursor-pointer"
                                style={{
                                  "border-top": "1px dashed #7b9fbf66",
                                  "border-bottom": "1px dashed #7b9fbf66",
                                }}
                                onClick={() => summary && setOpen(!open())}
                              >
                                <span class="flex-1 border-t border-dashed border-[#7b9fbf]/25" />
                                <span class="text-[8px] font-mono text-[#7b9fbf]/40 tracking-wider shrink-0">
                                  context compacted
                                </span>
                                <Show when={summary}>
                                  <span class="text-text-sub/30 shrink-0">
                                    {open() ? <CaretDown size={8} /> : <CaretRight size={8} />}
                                  </span>
                                </Show>
                                <span class="flex-1 border-t border-dashed border-[#7b9fbf]/25" />
                              </div>
                              <Show when={summary}>
                                <div class={`tool-call-body ${open() ? "tool-call-expanded" : "tool-call-collapsed"}`}>
                                  <div class="px-3 pb-2 max-h-[200px] overflow-y-auto">
                                    <MarkdownBlock text={summary!} maxLength={2000} />
                                  </div>
                                </div>
                              </Show>
                            </>
                          );
                        })()}
                      </Show>

                      {/* ── SessionEnd: summary receipt ───────────────────────── */}
                      <Show when={event.hook_event_name === "SessionEnd"}>
                        <div class="border-t border-panel-border/30 bg-panel/20 px-3 py-2 mt-1">
                          <div class="flex items-center gap-2 mb-1.5">
                            <span class="text-[10px] font-bold text-text-sub">Session ended</span>
                            <Show when={event.end_reason}>
                              <span
                                class={`text-[8px] font-mono px-1 rounded-sm ${event.end_reason === "bypass_permissions_disabled" ? "text-attack bg-attack/10" : "text-text-dim bg-panel-border/20"}`}
                              >
                                {event.end_reason}
                              </span>
                            </Show>
                            <Timestamp ts={event.timestamp} class="text-[9px] text-text-sub ml-auto shrink-0" />
                          </div>
                          <div class="grid grid-cols-3 gap-x-3 gap-y-1 text-[9px]">
                            <div>
                              <span class="text-text-sub">Duration:</span>{" "}
                              <span class="text-text-dim">{duration()}</span>
                            </div>
                            <div>
                              <span class="text-text-sub">Edits:</span>{" "}
                              <span class="text-text-dim">{s().edit_count}</span>
                            </div>
                            <div>
                              <span class="text-text-sub">Commands:</span>{" "}
                              <span class="text-text-dim">{s().command_count}</span>
                            </div>
                            <div>
                              <span class="text-text-sub">Reads:</span>{" "}
                              <span class="text-text-dim">{s().read_count}</span>
                            </div>
                            <div>
                              <span class="text-text-sub">Files:</span>{" "}
                              <span class="text-text-dim">{s().files_touched?.length || 0}</span>
                            </div>
                            <Show when={s().error_count}>
                              <div>
                                <span class="text-text-sub">Errors:</span>{" "}
                                <span class="text-attack">{s().error_count}</span>
                              </div>
                            </Show>
                            <Show when={s().compaction_count}>
                              <div>
                                <span class="text-text-sub">Compactions:</span>{" "}
                                <span class="text-[#7b9fbf]">{s().compaction_count}</span>
                              </div>
                            </Show>
                          </div>
                        </div>
                      </Show>

                      {/* ── All other lifecycle events (generic) ─────────────── */}
                      <Show
                        when={
                          event.hook_event_name !== "UserPromptSubmit" &&
                          event.hook_event_name !== "Stop" &&
                          event.hook_event_name !== "StopFailure" &&
                          event.hook_event_name !== "SessionStart" &&
                          event.hook_event_name !== "SessionEnd" &&
                          event.hook_event_name !== "SubagentStart" &&
                          event.hook_event_name !== "SubagentStop" &&
                          event.hook_event_name !== "PreCompact" &&
                          event.hook_event_name !== "PostCompact" &&
                          !event.tool_name
                        }
                      >
                        <div class="border-b border-panel-border/20 flex items-center gap-2" style={{ "min-height": "1.75rem", padding: "4px 12px" }}>
                          <span
                            class={`text-[10px] font-bold uppercase ${
                              event.hook_event_name === "PostToolUseFailure"
                                ? "text-attack"
                                : event.hook_event_name === "Notification" ||
                                    event.hook_event_name === "PermissionRequest"
                                  ? "text-suspicious"
                                  : event.hook_event_name === "PermissionDenied"
                                    ? "text-attack"
                                    : "text-text-sub"
                            }`}
                          >
                            {event.hook_event_name}
                          </span>
                          <Show when={event.hook_event_name === "PostToolUseFailure" && event.error}>
                            <span class="text-[9px] text-attack truncate">{(event.error as string)?.slice(0, 60)}</span>
                            <CopyContextBtn session={s()} event={event} />
                          </Show>
                          <Show when={event.hook_event_name === "Notification" && event.notification_message}>
                            <span class="text-[9px] text-text-dim truncate">{event.notification_message}</span>
                          </Show>
                          <Show when={event.hook_event_name === "PermissionDenied"}>
                            <span class="text-[9px] text-attack">{event.tool_name} denied</span>
                            <Show when={event.permission_denied_reason}>
                              <span class="text-[8px] text-text-dim truncate">
                                {event.permission_denied_reason!.slice(0, 40)}
                              </span>
                            </Show>
                          </Show>
                          <Show when={event.hook_event_name === "PermissionRequest"}>
                            <span class="text-[9px] text-text-dim">{event.tool_name} needs permission</span>
                          </Show>
                          <Timestamp ts={event.timestamp} class="text-[9px] text-text-sub ml-auto shrink-0" />
                        </div>
                      </Show>
                    </>
                  }
                >
                  <Show
                    when={questionBatches().has(i())}
                    fallback={
                      <Show
                        when={fileGroups().has(i())}
                        fallback={
                          <ToolCallBlock
                            event={event}
                            defaultExpanded={i() >= timeline().length - 5}
                            focused={focusedIdx() === i()}
                            compact={compactMode()}
                          />
                        }
                      >
                        <FileGroupBlock
                          events={fileGroups()
                            .get(i())!
                            .map((idx) => timeline()[idx])}
                          defaultExpanded={false}
                        />
                      </Show>
                    }
                  >
                    <QuestionBatchBlock
                      events={questionBatches()
                        .get(i())!
                        .map((idx) => timeline()[idx])}
                      defaultExpanded={i() >= timeline().length - 5}
                    />
                  </Show>
                </Show>
              </div>
            </Show>
          )}
        </For>

        <Show when={props.historyLoading && timeline().length === 0}>
          <div class="flex items-center justify-center gap-2 py-6">
            <span class="w-2 h-2 rounded-full bg-text-sub animate-pulse" />
            <span class="text-[10px] text-text-dim">Loading history...</span>
          </div>
        </Show>

        <Show when={timeline().length === 0 && !props.historyLoading}>
          <div class="p-4 space-y-3">
            {/* Session info grid */}
            <div class="border border-panel-border rounded-sm bg-card">
              <div class="px-3 py-2 border-b border-panel-border/50">
                <span class="text-[9px] text-text-sub uppercase tracking-wider">Session Details</span>
              </div>
              <div class="p-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[10px]">
                <div>
                  <span class="text-text-sub block text-[8px] uppercase tracking-wider mb-0.5">Session ID</span>
                  <span class="text-text-primary font-mono select-all">{s().session_id}</span>
                </div>
                <div>
                  <span class="text-text-sub block text-[8px] uppercase tracking-wider mb-0.5">Project</span>
                  <span class="text-text-primary">{s().project_name}</span>
                </div>
                <Show when={s().model}>
                  <div>
                    <span class="text-text-sub block text-[8px] uppercase tracking-wider mb-0.5">Model</span>
                    <span class="text-text-dim">{s().model}</span>
                  </div>
                </Show>
                <Show when={s().permission_mode}>
                  <div>
                    <span class="text-text-sub block text-[8px] uppercase tracking-wider mb-0.5">Permissions</span>
                    <PermissionBadge mode={s().permission_mode!} />
                  </div>
                </Show>
                <Show when={s().branch}>
                  <div>
                    <span class="text-text-sub block text-[8px] uppercase tracking-wider mb-0.5">Branch</span>
                    <span class="text-text-dim flex items-center gap-1">
                      <GitBranch size={9} /> {s().branch}
                    </span>
                  </div>
                </Show>
                <div>
                  <span class="text-text-sub block text-[8px] uppercase tracking-wider mb-0.5">Source</span>
                  <span class="text-text-dim">{s().source || "local"}</span>
                </div>
                <Show when={s().project_path}>
                  <div class="col-span-2">
                    <span class="text-text-sub block text-[8px] uppercase tracking-wider mb-0.5">Path</span>
                    <span class="text-text-dim font-mono text-[9px] select-all">{s().project_path}</span>
                  </div>
                </Show>
                <Show when={s().cwd && s().cwd !== s().project_path}>
                  <div class="col-span-2">
                    <span class="text-text-sub block text-[8px] uppercase tracking-wider mb-0.5">
                      Working Directory
                    </span>
                    <span class="text-text-dim font-mono text-[9px] select-all">{s().cwd}</span>
                  </div>
                </Show>
                <Show when={s().transcript_path}>
                  <div class="col-span-2">
                    <span class="text-text-sub block text-[8px] uppercase tracking-wider mb-0.5">Transcript</span>
                    <span class="text-text-dim font-mono text-[9px] select-all">{s().transcript_path}</span>
                  </div>
                </Show>
              </div>
            </div>

            {/* Resume/find session command */}
            <Show when={s().status === "waiting" || s().status === "working" || s().status === "thinking"}>
              <div class="border border-panel-border rounded-sm bg-card">
                <div class="px-3 py-2 border-b border-panel-border/50">
                  <span class="text-[9px] text-text-sub uppercase tracking-wider">Find This Session</span>
                </div>
                <div class="p-3 space-y-2">
                  <div class="text-[10px] text-text-dim">This session is running locally. Resume it with:</div>
                  <div
                    class="bg-[#0c0c0c] border border-panel-border rounded px-3 py-2 font-mono text-[11px] text-safe cursor-pointer hover:border-safe/30 transition-colors select-all"
                    title="Click to copy"
                    onClick={() => navigator.clipboard.writeText(`claude --resume ${s().session_id}`)}
                  >
                    claude --resume {s().session_id}
                  </div>
                  <Show when={s().cwd}>
                    <div class="text-[9px] text-text-sub">
                      Run from: <span class="font-mono text-text-dim">{s().cwd}</span>
                    </div>
                  </Show>
                </div>
              </div>
            </Show>

            {/* Files touched */}
            <Show when={s().files_touched?.length}>
              <div class="border border-panel-border rounded-sm bg-card">
                <div class="px-3 py-2 border-b border-panel-border/50">
                  <span class="text-[9px] text-text-sub uppercase tracking-wider">
                    Files Touched ({s().files_touched!.length})
                  </span>
                </div>
                <div class="p-2 space-y-0.5 max-h-[150px] overflow-y-auto">
                  <For each={s().files_touched!}>
                    {(fp) => (
                      <div class="px-2 py-0.5">
                        <FileBadge path={fp} />
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            {/* Recent commands */}
            <Show when={s().commands_run?.length}>
              <div class="border border-panel-border rounded-sm bg-card">
                <div class="px-3 py-2 border-b border-panel-border/50">
                  <span class="text-[9px] text-text-sub uppercase tracking-wider">
                    Recent Commands ({s().commands_run!.length})
                  </span>
                </div>
                <div class="p-2 space-y-0.5 max-h-[120px] overflow-y-auto">
                  <For each={s().commands_run!}>
                    {(cmd) => (
                      <div class="px-2 py-0.5 text-[9px] font-mono text-text-dim truncate">
                        <span class="text-text-sub">$</span> {cmd}
                      </div>
                    )}
                  </For>
                </div>
              </div>
            </Show>
          </div>
        </Show>
      </div>

      {/* ── Orbit Panel: subagent satellite cards ──────────────── */}
      <Show when={hasSubagents() && !props.isMobile}>
        <div class="w-[200px] shrink-0 border-l border-panel-border overflow-y-auto smooth-scroll bg-bg">
          <div class="px-2 py-1.5 border-b border-panel-border">
            <span class="text-[8px] text-text-label uppercase tracking-[1.5px]">Agents</span>
            <span class="text-[9px] text-text-sub ml-1">{orbitEntries().length}</span>
          </div>
          <For each={orbitEntries()}>
            {(orbit) => {
              const [orbitOpen, setOrbitOpen] = createSignal(!orbit.endTs);
              const isDone = () => orbit.endTs !== null;
              const durationLabel = () => {
                if (!orbit.endTs) return "running";
                const ms = orbit.endTs - orbit.startTs;
                if (ms < 1000) return "<1s";
                if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
                const m = Math.floor(ms / 60000);
                const sec = Math.round((ms % 60000) / 1000);
                return `${m}m ${sec}s`;
              };
              const typeColor = () => agentColor(orbit.type);
              return (
                <div class="border-b border-panel-border/30">
                  <button
                    class="flex items-center gap-1.5 w-full px-2 py-1.5 hover:bg-panel/20 text-left"
                    onClick={() => setOrbitOpen(!orbitOpen())}
                  >
                    <span
                      class="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{
                        background: isDone() ? "#4a4640" : typeColor(),
                        "box-shadow": isDone() ? "none" : `0 0 4px ${typeColor()}`,
                      }}
                    />
                    <span
                      class="text-[8px] font-mono font-bold px-1 rounded-sm truncate"
                      style={{ color: typeColor(), background: typeColor() + "15" }}
                    >
                      {orbit.type || "agent"}
                    </span>
                    <span class="text-[8px] text-text-sub ml-auto shrink-0">{orbit.toolCount}t</span>
                    <span class="text-[8px] text-text-dim font-mono shrink-0">{durationLabel()}</span>
                    <span class="text-text-sub shrink-0">
                      {orbitOpen() ? <CaretDown size={8} /> : <CaretRight size={8} />}
                    </span>
                  </button>
                  <div class={`tool-call-body ${orbitOpen() ? "tool-call-expanded" : "tool-call-collapsed"}`}>
                    <div class="px-1">
                      <For each={orbit.events}>
                        {(ev) => (
                          <div
                            class="flex items-center gap-1 px-1.5 py-0.5 text-[8px] border-b border-panel-border/10 hover:bg-panel/10"
                            title={ev.tool_input?.file_path as string || ev.tool_input?.command as string || ""}
                          >
                            <span
                              class="w-1 h-1 rounded-full shrink-0"
                              style={{ background: ev.hook_event_name === "PreToolUse" ? typeColor() : "#4a4640" }}
                            />
                            <span class="font-mono font-bold text-text-sub w-[32px] shrink-0 truncate">
                              {ev.tool_name || ev.hook_event_name}
                            </span>
                            <span class="text-text-dim truncate min-w-0 flex-1">
                              {(ev.tool_input?.file_path as string)?.split("/").pop() ||
                               (ev.tool_input?.command as string)?.slice(0, 30) ||
                               (ev.tool_input?.pattern as string)?.slice(0, 20) ||
                               (ev.tool_input?.description as string)?.slice(0, 25) ||
                               ""}
                            </span>
                            <Show when={ev.duration_ms}>
                              <span class="text-text-dim font-mono shrink-0">
                                {ev.duration_ms! < 1000 ? "<1s" : `${(ev.duration_ms! / 1000).toFixed(1)}s`}
                              </span>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                </div>
              );
            }}
          </For>
        </div>
      </Show>
      </div>{/* end timeline + orbit row */}

      {/* New messages indicator / Jump to latest */}
      <Show when={!autoScroll()}>
        <div class="absolute bottom-[68px] left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={jumpToLatest}
            class="bg-panel border border-panel-border rounded-full px-3 py-1 text-[10px] text-text-label hover:text-text-primary hover:border-text-dim transition-colors shadow-lg flex items-center gap-1.5"
          >
            <Show when={newMessageCount() > 0}>
              <span
                class="inline-flex items-center justify-center min-w-[16px] h-[16px] rounded-full text-[9px] font-bold px-1"
                style={{ background: "#a3b18a25", color: "#a3b18a" }}
              >
                {newMessageCount()}
              </span>
              <span>new</span>
            </Show>
            <Show when={newMessageCount() === 0}>
              Jump to latest
            </Show>
          </button>
        </div>
      </Show>

      {/* Session info bar — fixed at bottom, aligned with CONFLICTS */}
      <div
        class={`shrink-0 border-t border-panel-border px-3 py-2 bg-item ${props.isMobile ? "sticky bottom-0 z-10 mobile-footer" : ""}`}
      >
        <div class="flex items-center gap-2 text-[10px]">
          <span
            class={`w-2 h-2 rounded-full shrink-0 status-transition ${s().status === "working" || s().status === "thinking" ? "animate-pulse" : ""}`}
            style={{
              background: statusColor(),
              "box-shadow": s().status === "working" ? `0 0 6px ${statusColor()}` : "none",
            }}
          />
          <Show when={s().branch}>
            <span class="flex items-center gap-0.5 text-text-sub truncate min-w-0">
              <GitBranch size={9} class="shrink-0" /> {s().branch}
            </span>
          </Show>
          <span class="text-text-sub ml-auto">{duration()}</span>
        </div>
        <div
          class="flex gap-2 text-[9px] text-text-dim mt-0.5 session-stats"
          style={{ "white-space": "nowrap", "overflow-x": "auto" }}
        >
          <Show when={s().edit_count}>
            <span>{s().edit_count}e</span>
          </Show>
          <Show when={s().command_count}>
            <span>{s().command_count}c</span>
          </Show>
          <Show when={s().read_count}>
            <span>{s().read_count}r</span>
          </Show>
          <Show when={s().search_count}>
            <span>{s().search_count}s</span>
          </Show>
          <Show when={s().tool_rate}>
            <span>{s().tool_rate} t/min</span>
          </Show>
          <Show when={s().error_count}>
            <span class="text-attack">{s().error_count} err</span>
          </Show>
          <Show when={s().permission_denied_count}>
            <span class="text-attack">{s().permission_denied_count} denied</span>
          </Show>
          <Show when={s().compaction_count}>
            <span class="text-[#7b9fbf]">{s().compaction_count} compact</span>
          </Show>
          <Show when={s().files_touched?.length}>
            <span>{s().files_touched!.length} files</span>
          </Show>
          <span>{s().events.length} evts</span>
        </div>
      </div>
    </div>
  );
};
