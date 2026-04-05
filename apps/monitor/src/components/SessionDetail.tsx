import { type Component, For, Show, createMemo, createSignal, createEffect, onCleanup } from "solid-js";
import type { MonitorEvent, SessionState } from "../../../../packages/types/monitor";
import { STATUS_LABELS, STATUS_COLORS } from "../../../../packages/types/monitor";
import { Eye, PencilSimple, Terminal, GitBranch, CaretDown, CaretRight, Circle } from "./Icons";
import { FileBadge } from "./FileBadge";
import { Timestamp } from "./Timestamp";
import { formatDuration } from "../utils/time";

const TOOL_ICONS: Record<string, string> = {
  Read: ".", Edit: "~", Write: "+", Bash: ">_", Grep: "?", Glob: "*", Agent: "@",
};

// ── Collapsible Tool Call ───────────────────────────────────────────

function ToolCallBlock(props: { event: MonitorEvent; defaultExpanded: boolean }) {
  const [expanded, setExpanded] = createSignal(props.defaultExpanded);
  const e = () => props.event;
  const input = () => e().tool_input || {};
  const response = () => e().tool_response || {};
  const icon = () => TOOL_ICONS[e().tool_name || ""] || "o";
  const hasResponse = () => e().hook_event_name === "PostToolUse" && Object.keys(response()).length > 0;

  const filePath = (): string | null => {
    const fp = (input().file_path as string) || null;
    return fp;
  };

  const primaryDetail = () => {
    const inp = input();
    switch (e().tool_name) {
      case "Bash": return (inp.command as string) || "";
      case "Read": case "Edit": case "Write": return null; // handled by FileBadge
      case "Grep": return `/${inp.pattern || ""}/ in ${inp.path || "."}`;
      case "Glob": return (inp.pattern as string) || "";
      case "Agent": return (inp.description as string) || (inp.prompt as string)?.slice(0, 100) || "";
      default: return e().tool_name || "";
    }
  };

  // Diff rendering for Edit
  const diffLines = (): { type: "add" | "remove"; text: string }[] | null => {
    if (e().tool_name !== "Edit" && e().tool_name !== "Write") return null;
    const old_s = input().old_string as string;
    const new_s = input().new_string as string;
    if (!old_s && !new_s) return null;
    const lines: { type: "add" | "remove"; text: string }[] = [];
    if (old_s) {
      for (const l of old_s.split("\n").slice(0, 8)) lines.push({ type: "remove", text: l });
    }
    if (new_s) {
      for (const l of new_s.split("\n").slice(0, 8)) lines.push({ type: "add", text: l });
    }
    return lines.length > 0 ? lines : null;
  };

  // Bash output
  const bashOutput = () => {
    if (e().tool_name !== "Bash") return null;
    const resp = response();
    const stdout = (resp.stdout as string) || (resp.output as string) || "";
    const stderr = (resp.stderr as string) || "";
    const exitCode = resp.exitCode ?? resp.exit_code;
    return { stdout: stdout.slice(0, 800), stderr: stderr.slice(0, 200), exitCode };
  };

  // Read line count
  const readInfo = () => {
    if (e().tool_name !== "Read") return null;
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
    if (e().tool_name === "Bash") return (input().command as string || "").slice(0, 50);
    if (e().tool_name === "Agent") return (input().description as string || "").slice(0, 40);
    if (e().tool_name === "Grep") return `/${input().pattern || ""}/`;
    if (e().tool_name === "Glob") return (input().pattern as string || "");
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

  return (
    <div class="border-b border-panel-border/20 event-enter">
      {/* Header row — always visible, clickable. Shows file badge + summary inline */}
      <button
        class="flex items-center gap-1.5 w-full px-3 py-1.5 hover:bg-panel/20 text-left"
        onClick={() => setExpanded(!expanded())}
      >
        <span class="text-[11px] text-text-dim w-4 text-center shrink-0 font-mono">{icon()}</span>
        <span class="text-[10px] font-bold text-text-label shrink-0">{e().tool_name || e().hook_event_name}</span>

        {/* File badge inline in header */}
        <Show when={filePath()}>
          <FileBadge path={filePath()!} />
        </Show>

        {/* Edit diff stat — always visible */}
        <Show when={editStat()}>
          {(stat) => (
            <span class="text-[8px] font-mono shrink-0">
              <span class="text-safe">+{stat().added}</span>
              {" "}
              <span class="text-attack">-{stat().removed}</span>
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
        <Show when={hasResponse()}>
          <span class="text-[7px] text-safe/50 uppercase tracking-wider">done</span>
        </Show>

        <Timestamp ts={e().timestamp} class="text-[9px] text-text-sub ml-auto shrink-0" />
        <span class="text-text-sub shrink-0 ml-1">
          {expanded() ? <CaretDown size={9} /> : <CaretRight size={9} />}
        </span>
      </button>

      {/* Body — collapsible */}
      <div class={`tool-call-body ${expanded() ? "tool-call-expanded" : "tool-call-collapsed"}`}>
        <div class="px-3 pb-2 pl-8">
          {/* Bash command (full, when expanded) */}
          <Show when={primaryDetail() && e().tool_name === "Bash"}>
            <div class="text-[10px] text-text-dim font-mono mb-1">
              <span class="text-text-sub">$ </span>{primaryDetail()}
            </div>
          </Show>

          {/* Non-bash detail */}
          <Show when={primaryDetail() && e().tool_name !== "Bash"}>
            <div class="text-[10px] text-text-dim font-mono mb-1">{primaryDetail()}</div>
          </Show>

          {/* Bash output — only render if there's actual content */}
          <Show when={bashOutput() && (bashOutput()!.stdout || bashOutput()!.stderr)}>
            {(bo) => (
              <div class="terminal-block mt-1">
                <Show when={bo().stdout}><span class="text-text-dim">{bo().stdout}</span></Show>
                <Show when={bo().stderr}><span class="text-attack">{bo().stderr}</span></Show>
              </div>
            )}
          </Show>

          {/* Diff block for Edit */}
          <Show when={diffLines()}>
            {(lines) => (
              <div class="mt-1 rounded-sm overflow-hidden border border-panel-border/30 text-[10px] font-mono leading-4">
                <For each={lines()}>
                  {(line) => (
                    <div class={line.type === "add" ? "diff-add" : "diff-remove"}>
                      {line.type === "add" ? "+ " : "- "}{line.text}
                    </div>
                  )}
                </For>
              </div>
            )}
          </Show>
        </div>
      </div>
    </div>
  );
}

// ── Main Session Detail Panel ───────────────────────────────────────

export const SessionDetail: Component<{
  session: SessionState;
  onClose: () => void;
}> = (props) => {
  const s = () => props.session;
  let scrollRef: HTMLDivElement | undefined;
  const [autoScroll, setAutoScroll] = createSignal(true);
  const [duration, setDuration] = createSignal(formatDuration(s().started_at));

  // Auto-update duration
  const timer = setInterval(() => setDuration(formatDuration(s().started_at)), 5000);
  onCleanup(() => clearInterval(timer));

  // Events sorted chronologically
  const timeline = createMemo(() =>
    s().events.filter((e) => e.tool_name || e.hook_event_name === "Stop" || e.hook_event_name === "SessionStart")
      .sort((a, b) => a.timestamp - b.timestamp)
  );

  // Auto-scroll to bottom on new events
  createEffect(() => {
    const _ = timeline().length;
    if (autoScroll() && scrollRef) {
      requestAnimationFrame(() => scrollRef!.scrollTop = scrollRef!.scrollHeight);
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

  return (
    <div class="w-[440px] shrink-0 flex flex-col overflow-hidden border-l border-panel-border bg-bg">
      {/* Header — aligned with ACTIVITY header */}
      <div class="px-3 py-2 border-b border-panel-border flex items-center gap-2 shrink-0 h-[33px]">
        <button
          onClick={props.onClose}
          class="text-text-sub hover:text-text-primary transition-colors text-[11px] w-4"
        >
          x
        </button>
        <span class="text-[10px] text-text-label uppercase tracking-[2px]">Session Detail</span>
      </div>

      {/* Waiting banner — pinned, not scrollable */}
      <Show when={isWaiting()}>
        <div class="waiting-banner mx-2 mt-2 rounded-sm px-3 py-2 flex items-center gap-2">
          <span class="w-2.5 h-2.5 rounded-full bg-suspicious animate-pulse" style={{ "box-shadow": "0 0 8px var(--suspicious)" }} />
          <span class="text-[11px] font-bold text-suspicious">Claude needs your input</span>
        </div>
      </Show>

      {/* Scrollable tool call timeline */}
      <div
        ref={scrollRef}
        class="flex-1 overflow-y-auto smooth-scroll relative"
        onScroll={handleScroll}
      >
        <For each={timeline()}>
          {(event, i) => (
            <Show when={event.tool_name} fallback={
              <Show when={event.hook_event_name === "Stop" && event.last_assistant_message}>
                {(() => {
                  const [open, setOpen] = createSignal(false);
                  const text = event.last_assistant_message!;
                  // Clean preview: first meaningful line, no markdown cruft
                  const firstLine = text.split("\n").find(l => l.trim() && !l.startsWith("#") && !l.startsWith("-") && !l.startsWith("*"))?.trim() || text.slice(0, 100).trim();
                  const preview = firstLine.replace(/\*\*/g, "").slice(0, 100);
                  return (
                    <div class="border-b border-panel-border/20 bg-panel/20">
                      <button
                        class="flex items-center gap-2 w-full px-3 py-1.5 hover:bg-panel/30 text-left"
                        onClick={() => setOpen(!open())}
                      >
                        <span class="text-[10px] text-text-label shrink-0">Claude</span>
                        <span class="text-[9px] text-text-dim truncate">{preview}{text.length > 100 ? "..." : ""}</span>
                        <span class="text-text-sub ml-auto shrink-0">
                          {open() ? <CaretDown size={9} /> : <CaretRight size={9} />}
                        </span>
                      </button>
                      <div class={`tool-call-body ${open() ? "tool-call-expanded" : "tool-call-collapsed"}`}>
                        <div class="px-3 pb-2 pl-3 max-h-[300px] overflow-y-auto">
                          <For each={text.slice(0, 1500).split("\n")}>
                            {(line) => {
                              const trimmed = line.trim();
                              if (!trimmed) return <div class="h-2" />;
                              if (trimmed.startsWith("**") && trimmed.endsWith("**"))
                                return <div class="text-[10px] text-text-label font-bold mt-1">{trimmed.replace(/\*\*/g, "")}</div>;
                              if (trimmed.startsWith("- "))
                                return <div class="text-[10px] text-text-dim leading-4 pl-2 border-l border-panel-border/30">{trimmed.slice(2).replace(/\*\*/g, "")}</div>;
                              return <div class="text-[10px] text-text-dim leading-4">{trimmed.replace(/\*\*/g, "").replace(/`([^`]+)`/g, "$1")}</div>;
                            }}
                          </For>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </Show>
            }>
              <ToolCallBlock
                event={event}
                defaultExpanded={i() >= timeline().length - 5}
              />
            </Show>
          )}
        </For>

        <Show when={timeline().length === 0}>
          <div class="flex items-center justify-center py-12 text-[11px] text-text-sub">
            No events yet
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
      <div class="shrink-0 border-t border-panel-border px-3 py-2 bg-item">
        <div class="flex items-center gap-2 text-[10px]">
          <span
            class={`w-2 h-2 rounded-full shrink-0 status-transition ${s().status === "working" || s().status === "thinking" ? "animate-pulse" : ""}`}
            style={{ background: statusColor(), "box-shadow": s().status === "working" ? `0 0 6px ${statusColor()}` : "none" }}
          />
          <span class="font-bold text-text-primary font-mono">{s().session_id.slice(0, 8)}</span>
          <Show when={s().branch}>
            <span class="flex items-center gap-0.5 text-text-sub">
              <GitBranch size={9} /> {s().branch}
            </span>
          </Show>
          <Show when={s().permission_mode}>
            <span class="text-text-sub">{s().permission_mode === "bypassPermissions" ? "bypass" : s().permission_mode}</span>
          </Show>
          <span class="text-text-sub ml-auto">{duration()}</span>
        </div>
        <div class="flex gap-2 text-[9px] text-text-dim mt-0.5">
          <Show when={s().edit_count}><span>{s().edit_count} edits</span></Show>
          <Show when={s().command_count}><span>{s().command_count} cmds</span></Show>
          <Show when={s().read_count}><span>{s().read_count} reads</span></Show>
          <Show when={s().search_count}><span>{s().search_count} searches</span></Show>
          <span>{s().events.length} events</span>
        </div>
      </div>
    </div>
  );
};
