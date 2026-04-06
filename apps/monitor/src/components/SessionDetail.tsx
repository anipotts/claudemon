import { type Component, For, Show, createMemo, createSignal, createEffect, onCleanup } from "solid-js";
import type { MonitorEvent, SessionState } from "../../../../packages/types/monitor";
import { STATUS_COLORS } from "../../../../packages/types/monitor";
import { GitBranch, CaretDown, CaretRight, Key, ShieldCheck, Warning, Check, X } from "./Icons";
import type { PendingAction } from "../../../../packages/types/monitor";
import { PermissionBadge } from "./PermissionBadge";
import { ModelBadge } from "./ModelBadge";
import { FileBadge } from "./FileBadge";
import { SessionBadge } from "./SessionBadge";
import { Timestamp } from "./Timestamp";
import { MarkdownBlock } from "./Markdown";
import { formatDuration } from "../utils/time";
import { extractErrorContext, formatAsMarkdown } from "../utils/error-context";

const TOOL_ICONS: Record<string, string> = {
  Read: ".",
  Edit: "~",
  Write: "+",
  Bash: ">_",
  Grep: "?",
  Glob: "*",
  Agent: "@",
};

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
        class="flex items-center gap-1.5 w-full px-3 py-1.5 hover:bg-panel/20 text-left"
        onClick={() => setExpanded(!expanded())}
      >
        <span class="text-[11px] text-text-dim w-4 text-center shrink-0 font-mono">?</span>
        <span class="text-[10px] font-bold text-suspicious shrink-0">AskUserQuestion</span>
        <span class="text-[9px] text-text-sub bg-panel-border/20 px-1 rounded-sm">{count()} questions</span>
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

// ── Collapsible Tool Call ───────────────────────────────────────────

function ToolCallBlock(props: { event: MonitorEvent; defaultExpanded: boolean; focused?: boolean }) {
  const [expanded, setExpanded] = createSignal(props.defaultExpanded);
  const e = () => props.event;
  const input = () => e().tool_input || {};
  const response = () => e().tool_response || {};
  const icon = () => TOOL_ICONS[e().tool_name || ""] || "o";
  const hasResponse = () => e().hook_event_name === "PostToolUse" && Object.keys(response()).length > 0;
  const isRunning = () => e().hook_event_name === "PreToolUse";

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
    <div class={`border-b border-panel-border/30 event-enter ${props.focused ? "ring-1 ring-safe/30" : ""}`}>
      {/* Header row — always visible, clickable. Shows file badge + summary inline */}
      <button
        class={`flex items-center gap-1.5 w-full px-3 py-1.5 hover:bg-panel/20 text-left ${isPassiveTool() ? "opacity-70" : ""}`}
        onClick={() => setExpanded(!expanded())}
      >
        <span class="text-[11px] text-text-dim w-4 text-center shrink-0 font-mono">{icon()}</span>
        <span class="text-[10px] font-bold text-text-label shrink-0">{e().tool_name || e().hook_event_name}</span>

        {/* Bash command label badge */}
        <Show when={cmdLabel()}>
          {(cl) => (
            <span
              class="text-[9px] font-bold uppercase px-1 rounded-sm shrink-0"
              style={{ color: cl().color, background: cl().color + "18" }}
            >
              {cl().label}
            </span>
          )}
        </Show>

        {/* File badge inline in header */}
        <Show when={filePath()}>
          <FileBadge path={filePath()!} />
        </Show>

        {/* Edit: replace_all badge */}
        <Show when={isReplaceAll()}>
          <span class="text-[9px] text-suspicious bg-suspicious/10 px-1 rounded-sm shrink-0">all</span>
        </Show>

        {/* Edit diff stat — always visible */}
        <Show when={editStat()}>
          {(stat) => (
            <span class="text-[8px] font-mono shrink-0">
              <span class="text-safe">+{stat().added}</span> <span class="text-attack">-{stat().removed}</span>
            </span>
          )}
        </Show>

        {/* Command/pattern summary inline */}
        <Show when={!filePath() && headerSummary()}>
          <span class="text-[9px] text-text-dim truncate font-mono">{headerSummary()}</span>
        </Show>

        {/* Info pills */}
        <Show when={readInfo()}>
          <span class="text-[8px] text-text-sub bg-panel-border/20 px-1 rounded-sm">{readInfo()}</span>
        </Show>
        <Show when={writeInfo()}>
          <span class="text-[8px] text-text-sub bg-panel-border/20 px-1 rounded-sm">{writeInfo()}</span>
        </Show>

        {/* Bash exit code — red badge for non-zero */}
        <Show
          when={bashOutput()?.exitCode !== undefined && bashOutput()!.exitCode !== 0 && bashOutput()!.exitCode !== null}
        >
          <span class="text-[9px] font-bold text-attack bg-attack/15 px-1 rounded-sm">
            exit {String(bashOutput()!.exitCode)}
          </span>
        </Show>

        {/* In-progress spinner or timeout badge for PreToolUse */}
        <Show when={isRunning()}>
          <Show
            when={timedOut()}
            fallback={
              <span class="inline-flex items-center gap-1 shrink-0">
                <span class="w-1.5 h-1.5 rounded-full bg-safe tool-running shrink-0" />
                <Show when={liveElapsedLabel()}>
                  <span class="text-[9px] text-safe/60 font-mono">{liveElapsedLabel()}</span>
                </Show>
              </span>
            }
          >
            <span class="text-[9px] font-bold text-suspicious bg-suspicious/10 px-1 rounded-sm uppercase shrink-0">
              timed out
            </span>
          </Show>
        </Show>

        {/* Done badge + duration for completed tools */}
        <Show when={hasResponse() && !(bashOutput()?.exitCode !== undefined && bashOutput()!.exitCode !== 0)}>
          <span class="text-[9px] text-safe/50 uppercase tracking-wider">done</span>
        </Show>
        <Show when={durationLabel()}>
          <span class="text-[8px] text-text-sub font-mono">{durationLabel()}</span>
        </Show>

        <Timestamp ts={e().timestamp} class="text-[9px] text-text-sub ml-auto shrink-0" />
        <span class="text-text-sub shrink-0 ml-1">{expanded() ? <CaretDown size={9} /> : <CaretRight size={9} />}</span>
      </button>

      {/* Body — collapsible */}
      <div class={`tool-call-body ${expanded() ? "tool-call-expanded" : "tool-call-collapsed"}`}>
        <div class="px-3 pb-2 pl-8">
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
}> = (props) => {
  const s = () => props.session;
  let scrollRef: HTMLDivElement | undefined;
  const [autoScroll, setAutoScroll] = createSignal(true);
  const [duration, setDuration] = createSignal(formatDuration(s().started_at));

  // Auto-update duration
  const timer = setInterval(() => setDuration(formatDuration(s().started_at)), 5000);
  onCleanup(() => clearInterval(timer));

  // Events sorted chronologically, with agent_id for nesting
  const timeline = createMemo(() =>
    s()
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
      .sort((a, b) => a.timestamp - b.timestamp),
  );

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

  // Auto-scroll to bottom on new events
  createEffect(() => {
    const _ = timeline().length;
    if (autoScroll() && scrollRef) {
      requestAnimationFrame(() => (scrollRef!.scrollTop = scrollRef!.scrollHeight));
    }
  });

  const handleScroll = () => {
    if (!scrollRef) return;
    const atBottom = scrollRef.scrollHeight - scrollRef.scrollTop - scrollRef.clientHeight < 50;
    setAutoScroll(atBottom);
  };

  const jumpToLatest = () => {
    if (scrollRef) {
      scrollRef.scrollTop = scrollRef.scrollHeight;
      setAutoScroll(true);
    }
  };

  const statusColor = () => STATUS_COLORS[s().status] || "#666";
  const isWaiting = () => s().status === "waiting";

  // Keyboard navigation
  const [focusedIdx, setFocusedIdx] = createSignal(-1);

  const handleKeyDown = (ev: KeyboardEvent) => {
    const len = timeline().length;
    if (len === 0) return;
    if (ev.key === "j" || ev.key === "ArrowDown") {
      ev.preventDefault();
      setFocusedIdx((i) => Math.min(i + 1, len - 1));
    } else if (ev.key === "k" || ev.key === "ArrowUp") {
      ev.preventDefault();
      setFocusedIdx((i) => Math.max(i - 1, 0));
    } else if (ev.key === "Escape") {
      setFocusedIdx(-1);
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

  return (
    <div class={`${props.isMobile ? "w-full flex-1" : "flex-1 min-w-0"} flex flex-col overflow-hidden bg-bg`}>
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
        <Show when={s().model}>
          <span class="ml-auto shrink-0">
            <ModelBadge model={s().model!} />
          </span>
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
          <div
            class="mt-2 bg-[#0c0c0c] border border-suspicious/20 rounded px-2.5 py-1.5 font-mono text-[10px] text-suspicious/80 cursor-pointer hover:border-suspicious/40 transition-colors select-all"
            title="Click to copy resume command"
            onClick={() => navigator.clipboard.writeText(`claude --resume ${s().session_id}`)}
          >
            claude --resume {s().session_id}
          </div>
          <Show when={s().cwd}>
            <div class="text-[8px] text-text-sub mt-1">in {s().cwd}</div>
          </Show>
        </div>
      </Show>

      <Show when={s().compact_summary}>
        <div class="mx-2 mt-2 rounded-sm px-3 py-2 bg-[#7b9fbf]/10 border border-[#7b9fbf]/20">
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-bold text-[#7b9fbf]">Context compacted</span>
            <span class="text-[9px] text-text-dim">x{s().compaction_count || 1}</span>
          </div>
          <div class="text-[9px] text-text-dim mt-1 line-clamp-2">{s().compact_summary}</div>
        </div>
      </Show>

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
            <Show when={!nestedIndices().has(i()) && !batchedIndices().has(i())}>
              <div data-tl-idx={i()}>
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
                            <div class="border-l-3 border-l-[#8a8478] bg-[#1a1916] mt-2">
                              <button
                                class="flex items-start gap-2 w-full px-3 py-2.5 hover:bg-[#8a847810] text-left"
                                onClick={() => hasMore && setOpen(!open())}
                              >
                                <span class="text-[11px] text-[#8a8478] font-bold shrink-0 mt-0.5">you</span>
                                <Show when={isSlashCmd}>
                                  <span class="text-[8px] font-mono font-bold text-safe bg-safe/10 px-1 rounded-sm shrink-0">
                                    {text.split(/\s/)[0]}
                                  </span>
                                </Show>
                                <span class="text-[10px] text-text-primary min-w-0">
                                  <Show when={!open()}>
                                    <span class="line-clamp-2">
                                      {isSlashCmd ? text.slice(text.indexOf(" ") + 1) : text}
                                    </span>
                                  </Show>
                                  <Show when={open()}>
                                    <span class="whitespace-pre-wrap break-words">{text}</span>
                                  </Show>
                                </span>
                                <Show when={hasMore}>
                                  <span class="text-text-sub shrink-0 ml-auto mt-0.5">
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
                            <div class="border-l-3 border-l-safe/40 bg-[#161412] mt-1">
                              <button
                                class="flex items-start gap-2 w-full px-3 py-2.5 hover:bg-safe/8 text-left"
                                onClick={() => hasText && setOpen(!open())}
                              >
                                <span class="text-[11px] text-safe font-bold shrink-0 mt-0.5">Claude</span>
                                <Show when={event.stop_hook_active}>
                                  <span class="text-[9px] font-bold text-suspicious bg-suspicious/10 px-1 rounded-sm uppercase shrink-0">
                                    verifying
                                  </span>
                                </Show>
                                <Show when={hasText && !open()}>
                                  <span class="text-[9px] text-text-dim truncate min-w-0">
                                    {firstLine}
                                    {text.length > 120 ? "..." : ""}
                                  </span>
                                </Show>
                                <Show when={!hasText}>
                                  <span class="text-[9px] text-text-sub italic">Done</span>
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
                        <div class="border-l-2 border-l-attack bg-attack/5 px-3 py-2">
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
                        <div class="border-b border-safe/20 bg-safe/5 px-3 py-2 flex items-center gap-2">
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
                                        <ToolCallBlock event={childEvent} defaultExpanded={false} />
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

                      {/* ── Compact events ────────────────────────────────────── */}
                      <Show when={event.hook_event_name === "PreCompact" || event.hook_event_name === "PostCompact"}>
                        {(() => {
                          const [open, setOpen] = createSignal(false);
                          const isPre = event.hook_event_name === "PreCompact";
                          const summary = event.compact_summary;
                          return (
                            <div class="border-l-2 border-l-[#7b9fbf]/40 bg-[#7b9fbf08]">
                              <button
                                class="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-[#7b9fbf10] text-left"
                                onClick={() => summary && setOpen(!open())}
                              >
                                <span class="text-[9px] font-bold text-[#7b9fbf]">
                                  {isPre ? "Compacting..." : "Compacted"}
                                </span>
                                <span class="text-[8px] text-[#7b9fbf]/60">
                                  {event.compact_trigger === "auto" ? "auto" : "manual"}
                                </span>
                                <Show when={summary && !open()}>
                                  <span class="text-[8px] text-text-dim truncate min-w-0">{summary!.slice(0, 60)}</span>
                                </Show>
                                <Timestamp ts={event.timestamp} class="text-[9px] text-text-sub ml-auto shrink-0" />
                                <Show when={summary}>
                                  <span class="text-text-sub shrink-0">
                                    {open() ? <CaretDown size={9} /> : <CaretRight size={9} />}
                                  </span>
                                </Show>
                              </button>
                              <Show when={summary}>
                                <div class={`tool-call-body ${open() ? "tool-call-expanded" : "tool-call-collapsed"}`}>
                                  <div class="px-3 pb-2 pl-3 max-h-[200px] overflow-y-auto">
                                    <MarkdownBlock text={summary!} maxLength={2000} />
                                  </div>
                                </div>
                              </Show>
                            </div>
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
                        <div class="border-b border-panel-border/20 px-3 py-1.5 flex items-center gap-2">
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
                      <ToolCallBlock
                        event={event}
                        defaultExpanded={i() >= timeline().length - 5}
                        focused={focusedIdx() === i()}
                      />
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

        <Show when={timeline().length === 0}>
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

      {/* Jump to latest button */}
      <Show when={!autoScroll()}>
        <div class="absolute bottom-[68px] left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={jumpToLatest}
            class="bg-panel border border-panel-border rounded-full px-3 py-1 text-[10px] text-text-label hover:text-text-primary hover:border-text-dim transition-colors shadow-lg"
          >
            Jump to latest
          </button>
        </div>
      </Show>

      {/* Session info bar — fixed at bottom, aligned with CONFLICTS */}
      <div
        class={`shrink-0 border-t border-panel-border px-3 py-2 bg-item ${props.isMobile ? "sticky bottom-0 z-10" : ""}`}
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
