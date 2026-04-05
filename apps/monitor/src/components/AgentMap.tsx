import { type Component, createSignal, For, Show, createMemo, createEffect, onCleanup } from "solid-js";
import type { SessionState, SessionStatus } from "../../../../packages/types/monitor";
import { STATUS_LABELS } from "../../../../packages/types/monitor";
import { Desktop, Cloud, Terminal, Cube, GitBranch, Folder, CaretDown, CaretRight, Pulse } from "./Icons";
import { Timestamp } from "./Timestamp";
import { timeAgo, formatDuration } from "../utils/time";

const STATUS_STYLES: Record<SessionStatus, { color: string; bg: string; pulse: boolean }> = {
  working: { color: "#a3b18a", bg: "#a3b18a08", pulse: true },
  thinking: { color: "#7b9fbf", bg: "#7b9fbf08", pulse: true },
  waiting: { color: "#c9a96e", bg: "#c9a96e12", pulse: false },
  done: { color: "#666", bg: "#66666608", pulse: false },
  error: { color: "#b85c4a", bg: "#b85c4a08", pulse: false },
  offline: { color: "#4a4640", bg: "#4a464008", pulse: false },
};


// ── Session Card ────────────────────────────────────────────────────

function SessionCard(props: { session: SessionState; selected?: boolean; onSelect?: (id: string) => void }) {
  const s = () => props.session;
  const style = () => STATUS_STYLES[s().status] || STATUS_STYLES.offline;
  const statusLabel = () => STATUS_LABELS[s().status] || "Unknown";
  const isWaiting = () => s().status === "waiting";
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 5000);
  onCleanup(() => clearInterval(timer));

  const lastToolEvent = () => {
    const evts = s().events;
    for (let i = evts.length - 1; i >= 0; i--) {
      if (evts[i].tool_name) return evts[i];
    }
    return null;
  };

  const lastToolSummary = () => {
    const e = lastToolEvent();
    if (!e) return null;
    const input = e.tool_input || {};
    const name = e.tool_name || "";
    let detail = "";
    if (name === "Bash") detail = (input.command as string || "").slice(0, 60);
    else if (name === "Edit" || name === "Write" || name === "Read") {
      const fp = (input.file_path as string || "");
      detail = fp.split("/").slice(-2).join("/");
    }
    else if (name === "Agent") detail = (input.description as string || "").slice(0, 40);
    else detail = name;
    return { name, detail };
  };

  const counters = () => {
    const parts: string[] = [];
    if (s().edit_count) parts.push(`${s().edit_count} edit${s().edit_count !== 1 ? "s" : ""}`);
    if (s().command_count) parts.push(`${s().command_count} cmd${s().command_count !== 1 ? "s" : ""}`);
    if (s().read_count) parts.push(`${s().read_count} read${s().read_count !== 1 ? "s" : ""}`);
    if (s().search_count) parts.push(`${s().search_count} search${s().search_count !== 1 ? "es" : ""}`);
    return parts.length > 0 ? parts.join(" \u00b7 ") : null;
  };

  return (
    <div
      class={`border rounded-sm p-3 transition-all cursor-pointer status-transition ${props.selected ? "ring-1 ring-safe/50" : "hover:border-text-dim/30"} ${isWaiting() ? "waiting-banner" : ""}`}
      style={{
        "border-color": props.selected ? "var(--safe)" : isWaiting() ? undefined : style().color + "25",
        background: props.selected ? "#a3b18a08" : isWaiting() ? undefined : style().bg,
      }}
      onClick={() => props.onSelect?.(s().session_id)}
    >
      {/* Row 1: Status + ID + Badge */}
      <div class="flex items-center gap-2 mb-1">
        <span
          class={`w-2 h-2 rounded-full shrink-0 status-transition ${style().pulse ? "animate-pulse" : ""}`}
          style={{ background: style().color, "box-shadow": style().pulse ? `0 0 6px ${style().color}` : "none" }}
        />
        <span class="text-[11px] font-bold text-text-primary font-mono">{s().session_id.slice(0, 8)}</span>
        <span class="text-[9px] text-text-sub ml-auto">{formatDuration(s().started_at)}</span>
        <span
          class={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm shrink-0 ${isWaiting() ? "text-[9px] px-2 py-0.5" : ""}`}
          style={{ color: style().color, background: style().color + "20" }}
        >
          {statusLabel()}
        </span>
      </div>

      {/* Row 2: Branch + Counters */}
      <div class="flex items-center gap-2 text-[9px] text-text-dim">
        <Show when={s().branch}>
          <span class="flex items-center gap-0.5"><GitBranch size={9} /> {s().branch}</span>
        </Show>
        <Show when={counters()}>
          <span class="text-text-sub">{counters()}</span>
        </Show>
      </div>

      {/* Row 3: Last tool call */}
      <Show when={lastToolSummary()}>
        {(detail) => (
          <div class="flex items-center gap-1.5 text-[9px] text-text-dim mt-1 pt-1 border-t border-panel-border/20">
            <span class="text-text-label font-bold">{detail().name}</span>
            <span class="truncate">{detail().detail}</span>
            <span class="text-text-sub ml-auto shrink-0">{timeAgo(s().last_event_at)}</span>
          </div>
        )}
      </Show>
    </div>
  );
}

// ── Project Group ───────────────────────────────────────────────────

function ProjectGroup(props: { projectPath: string; sessions: SessionState[]; selectedId?: string | null; onSelect?: (id: string) => void }) {
  const [open, setOpen] = createSignal(true);
  const projectName = () => props.projectPath.split("/").pop() || props.projectPath;

  return (
    <div class="border border-panel-border rounded-sm bg-card">
      <button onClick={() => setOpen(!open())} class="flex items-center gap-2 px-3 py-1.5 w-full hover:bg-panel/30 transition-colors">
        {open() ? <CaretDown size={10} class="text-text-sub" /> : <CaretRight size={10} class="text-text-sub" />}
        <Folder size={12} class="text-text-dim" />
        <span class="text-[11px] font-bold text-text-primary">{projectName()}</span>
        <Show when={props.sessions[0]?.branch}>
          <span class="flex items-center gap-0.5 text-[9px] text-text-sub"><GitBranch size={9} /> {props.sessions[0].branch}</span>
        </Show>
        <span class="ml-auto text-[9px] text-text-sub">{props.sessions.length} session{props.sessions.length !== 1 ? "s" : ""}</span>
      </button>
      <Show when={open()}>
        <div class="px-2 pb-2 space-y-1.5">
          <For each={props.sessions}>
            {(session) => <SessionCard session={session} selected={session.session_id === props.selectedId} onSelect={props.onSelect} />}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ── Environment Group ───────────────────────────────────────────────

const ENV_ICONS: Record<string, typeof Desktop> = { local: Desktop, cloud: Cloud, ssh: Terminal, container: Cube };

function EnvironmentGroup(props: { hostname: string; envType: string; sessions: SessionState[]; selectedId?: string | null; onSelect?: (id: string) => void }) {
  const [open, setOpen] = createSignal(true);
  const EnvIcon = () => ENV_ICONS[props.envType] || Desktop;

  const projectGroups = createMemo(() => {
    const map = new Map<string, SessionState[]>();
    for (const s of props.sessions) {
      const key = s.project_path;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries());
  });

  return (
    <div>
      <button onClick={() => setOpen(!open())} class="flex items-center gap-2 px-1 py-1.5 w-full hover:bg-panel/30 transition-colors rounded-sm">
        {open() ? <CaretDown size={10} class="text-text-sub" /> : <CaretRight size={10} class="text-text-sub" />}
        {(() => { const I = EnvIcon(); return <I size={14} class="text-text-label" />; })()}
        <span class="text-[11px] font-bold text-text-primary">{props.hostname}</span>
        <span class="text-[9px] text-text-sub uppercase tracking-wider">{props.envType}</span>
        <span class="ml-auto flex items-center gap-1">
          <Pulse size={10} class="text-safe" />
          <span class="text-[9px] text-text-label">{props.sessions.length}</span>
        </span>
      </button>
      <Show when={open()}>
        <div class="space-y-1.5 mt-1">
          <For each={projectGroups()}>
            {([path, sessions]) => <ProjectGroup projectPath={path} sessions={sessions} selectedId={props.selectedId} onSelect={props.onSelect} />}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────

export const AgentMap: Component<{
  sessions: Record<string, SessionState>;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onPurge?: () => void;
}> = (props) => {
  const allSessions = createMemo(() => Object.values(props.sessions));
  const envGroups = createMemo(() => {
    const map = new Map<string, SessionState[]>();
    for (const s of allSessions()) {
      const key = s.machine_id || "unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries());
  });

  return (
    <Show
      when={allSessions().length > 0}
      fallback={
        <div class="flex flex-col items-center justify-center h-full gap-2 py-12">
          <Desktop size={28} class="text-text-sub" />
          <span class="text-[12px] text-text-dim">No agents connected</span>
        </div>
      }
    >
      <div class="space-y-2">
        <For each={envGroups()}>
          {([hostname, sessions]) => (
            <EnvironmentGroup hostname={hostname} envType={sessions[0]?.source || "local"} sessions={sessions} selectedId={props.selectedId} onSelect={props.onSelect} />
          )}
        </For>
      </div>
    </Show>
  );
};
