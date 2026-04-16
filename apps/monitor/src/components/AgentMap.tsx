import { type Component, createSignal, For, Show, createMemo, onCleanup } from "solid-js";
import type { SessionState, SessionStatus } from "../../../../packages/types/monitor";
import { STATUS_LABELS } from "../../../../packages/types/monitor";
import {
  Desktop,
  Cloud,
  Terminal,
  Cube,
  GitBranch,
  Folder,
  CaretDown,
  CaretRight,
  Pulse,
  Eye,
  EyeSlash,
  ArrowsClockwise,
} from "./Icons";
import { SessionBadge } from "./SessionBadge";
import { ModelBadge } from "./ModelBadge";
import { timeAgo, formatDuration } from "../utils/time";
import { summarizeMonitorTarget } from "../utils/monitor";

// Full 6-char hex required — shorthand (#666) breaks the + "25" alpha concat pattern
const STATUS_STYLES: Record<SessionStatus, { color: string; bg: string; border: string; pulse: boolean }> = {
  working: { color: "#a3b18a", bg: "#a3b18a08", border: "#a3b18a30", pulse: true },
  thinking: { color: "#7b9fbf", bg: "transparent", border: "#3d3a3440", pulse: true },
  waiting: { color: "#c9a96e", bg: "#c9a96e12", border: "#c9a96e40", pulse: false },
  done: { color: "#666666", bg: "transparent", border: "#3d3a3430", pulse: false },
  error: { color: "#b85c4a", bg: "#b85c4a08", border: "#b85c4a30", pulse: false },
  offline: { color: "#4a4640", bg: "transparent", border: "#3d3a3420", pulse: false },
};

const INACTIVE_STATUSES = new Set<SessionStatus>(["done", "offline"]);

// ── Session Card ────────────────────────────────────────────────────

function SessionCard(props: { session: SessionState; selected?: boolean; onSelect?: (id: string) => void }) {
  const s = () => props.session;
  const [now, setNow] = createSignal(Date.now());
  const timer = setInterval(() => setNow(Date.now()), 5000);
  onCleanup(() => clearInterval(timer));

  const isIdle = () => {
    const idleMs = now() - s().last_event_at;
    return (s().status === "thinking" || s().status === "working") && idleMs > 30_000;
  };
  const style = () =>
    isIdle()
      ? { color: "#666666", bg: "transparent", border: "#3d3a3430", pulse: false }
      : STATUS_STYLES[s().status] || STATUS_STYLES.offline;
  const statusLabel = () =>
    isIdle() ? `Idle (${timeAgo(s().last_event_at)})` : s().smart_status || STATUS_LABELS[s().status] || "Unknown";
  const isWaiting = () => s().status === "waiting";

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
    if (name === "Bash") detail = ((input.command as string) || "").slice(0, 60);
    else if (name === "Monitor") detail = summarizeMonitorTarget(input, 60) || "background watch";
    else if (name === "Edit" || name === "Write" || name === "Read") {
      const fp = (input.file_path as string) || "";
      detail = fp.split("/").slice(-2).join("/");
    } else if (name === "Agent") detail = ((input.description as string) || "").slice(0, 40);
    else detail = name;
    return { name, detail };
  };

  const counters = () => {
    const parts: string[] = [];
    if (s().edit_count) parts.push(`${s().edit_count}e`);
    if (s().command_count) parts.push(`${s().command_count}c`);
    if (s().read_count) parts.push(`${s().read_count}r`);
    if (s().search_count) parts.push(`${s().search_count}s`);
    return parts.length > 0 ? parts.join(" \u00b7 ") : null;
  };
  const counterTooltip = () => {
    const parts: string[] = [];
    if (s().edit_count) parts.push(`${s().edit_count} edits`);
    if (s().command_count) parts.push(`${s().command_count} commands`);
    if (s().read_count) parts.push(`${s().read_count} reads`);
    if (s().search_count) parts.push(`${s().search_count} searches`);
    return parts.join(", ");
  };
  const isOffline = () => s().status === "offline" || s().status === "done";

  const activeAgentCount = () => s().subagents.filter((a) => a.status !== "done" && a.status !== "offline").length;
  const activeMonitorLabel = () =>
    s().last_monitor_description || s().last_monitor_command || "Background watch active";

  return (
    <div
      class={`border rounded-sm p-3 transition-all cursor-pointer status-transition hover:brightness-110 ${isWaiting() ? "waiting-banner" : ""} ${isOffline() ? "opacity-50" : ""}`}
      style={{
        "border-color": props.selected ? "#a3b18a60" : isWaiting() ? undefined : style().border,
        background: props.selected ? "#a3b18a0a" : isWaiting() ? undefined : style().bg,
        "box-shadow": props.selected
          ? "inset 0 0 0 1px #a3b18a25"
          : s().status === "working" && !isIdle()
            ? "0 0 12px rgba(163, 177, 138, 0.1)"
            : "none",
      }}
      onClick={() => props.onSelect?.(s().session_id)}
    >
      {/* Row 1: Session badge + duration + status */}
      <div class="flex items-center gap-2 mb-1" style={{ "white-space": "nowrap" }}>
        <SessionBadge sessionId={s().session_id} status={s().status} showStatus={true} size="md" class="shrink-0" />
        <span class="text-[9px] text-text-sub ml-auto shrink-0">{formatDuration(s().started_at)}</span>
        <span
          class={`text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded-sm truncate min-w-0 ${isWaiting() ? "text-[9px] px-2 py-0.5" : ""}`}
          style={{ color: style().color, background: style().color + "20", "max-width": "180px" }}
          title={statusLabel()}
        >
          {statusLabel()}
        </span>
      </div>

      {/* Row 2: Model + Branch + Counters + Agents */}
      <div
        class="flex items-center gap-2 text-[9px] text-text-dim"
        style={{ "white-space": "nowrap", overflow: "hidden" }}
      >
        <Show when={s().model}>
          <ModelBadge model={s().model!} />
        </Show>
        <Show when={s().branch}>
          <span class="flex items-center gap-0.5 truncate shrink min-w-0">
            <GitBranch size={9} class="shrink-0" /> {s().branch}
          </span>
        </Show>
        <Show when={counters()}>
          <span class="text-text-sub shrink-0" title={counterTooltip()}>
            {counters()}
          </span>
        </Show>
        <Show when={activeAgentCount() > 0}>
          <span class="text-[8px] font-bold shrink-0" style={{ color: "#b07bac" }}>
            {activeAgentCount()} agent{activeAgentCount() > 1 ? "s" : ""}
          </span>
        </Show>
        <Show when={s().last_monitor_started_at}>
          <span
            class="inline-flex items-center gap-0.5 text-[8px] font-bold uppercase px-1 py-0.5 rounded-sm shrink-0"
            style={{ color: "#5f9ea0", background: "#5f9ea012" }}
            title={activeMonitorLabel()}
          >
            <Pulse size={8} />
            watch
          </span>
        </Show>
      </div>

      {/* Row 3: Last tool call */}
      <Show when={lastToolSummary()}>
        {(detail) => (
          <div
            class="flex items-center gap-1.5 text-[9px] text-text-dim mt-1 pt-1 border-t border-panel-border/20"
            style={{ "white-space": "nowrap", overflow: "hidden" }}
          >
            <span class="text-text-label font-bold shrink-0">{detail().name}</span>
            <span class="truncate min-w-0">{detail().detail}</span>
            <Show when={s().compaction_count}>
              <span
                class="shrink-0"
                style={{ color: s().compaction_count >= 3 ? "#c9a96e" : "#7b9fbf" }}
                title={`Context compacted ${s().compaction_count} times`}
              >
                <ArrowsClockwise size={9} /> {s().compaction_count}
              </span>
            </Show>
            <span class="text-text-sub ml-auto shrink-0">{timeAgo(s().last_event_at)}</span>
          </div>
        )}
      </Show>

      {/* Row 4: Last user prompt preview */}
      <Show when={s().last_prompt}>
        <div
          class="text-[8px] text-text-sub italic mt-1 truncate"
          style={{ overflow: "hidden", "white-space": "nowrap" }}
        >
          {s().last_prompt}
        </div>
      </Show>
    </div>
  );
}

// ── Project Group (supports nested children) ────────────────────────

interface ProjectNode {
  path: string;
  name: string;
  sessions: SessionState[];
  children: ProjectNode[];
}

function ProjectGroupView(props: {
  node: ProjectNode;
  depth?: number;
  selectedIds?: string[];
  onSelect?: (id: string) => void;
}) {
  const depth = () => props.depth || 0;
  const [open, setOpen] = createSignal(true);
  const totalSessions = (): number =>
    props.node.sessions.length + props.node.children.reduce((sum, c) => sum + c.sessions.length, 0);

  return (
    <div class="border border-panel-border rounded-sm bg-card" style={{ "margin-left": depth() > 0 ? "12px" : "0" }}>
      <button
        onClick={() => setOpen(!open())}
        class="flex items-center gap-2 px-3 py-1.5 w-full hover:bg-panel/30 transition-colors"
      >
        {open() ? <CaretDown size={10} class="text-text-sub" /> : <CaretRight size={10} class="text-text-sub" />}
        <Folder size={12} class="text-text-dim shrink-0" />
        <span class="text-[11px] font-bold text-text-primary truncate">{props.node.name}</span>
        <Show when={props.node.sessions[0]?.branch}>
          <span class="flex items-center gap-0.5 text-[9px] text-text-sub truncate shrink min-w-0">
            <GitBranch size={9} class="shrink-0" /> {props.node.sessions[0].branch}
          </span>
        </Show>
        <span class="ml-auto text-[9px] text-text-sub">
          {totalSessions()} session{totalSessions() !== 1 ? "s" : ""}
        </span>
      </button>
      <Show when={open()}>
        <div class="px-2 pb-2 space-y-1.5">
          {/* Direct sessions */}
          <For each={props.node.sessions}>
            {(session) => (
              <SessionCard
                session={session}
                selected={props.selectedIds?.includes(session.session_id)}
                onSelect={props.onSelect}
              />
            )}
          </For>
          {/* Child projects (nested) */}
          <For each={props.node.children}>
            {(child) => (
              <ProjectGroupView
                node={child}
                depth={depth() + 1}
                selectedIds={props.selectedIds}
                onSelect={props.onSelect}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ── Build project tree (detect parent/child by path containment) ────

function buildProjectTree(sessions: SessionState[]): ProjectNode[] {
  // Group by project_path
  const pathMap = new Map<string, SessionState[]>();
  for (const s of sessions) {
    const key = s.project_path;
    if (!pathMap.has(key)) pathMap.set(key, []);
    pathMap.get(key)!.push(s);
  }

  // Sort paths so parents come before children
  const paths = Array.from(pathMap.keys()).sort();

  // Build tree: if path A is a prefix of path B, B is a child of A
  const roots: ProjectNode[] = [];
  const nodeMap = new Map<string, ProjectNode>();

  for (const path of paths) {
    const name = path.split("/").pop() || path;
    const node: ProjectNode = { path, name, sessions: pathMap.get(path)!, children: [] };
    nodeMap.set(path, node);

    // Find parent: longest path that is a prefix of this path
    let parent: ProjectNode | null = null;
    for (const candidate of paths) {
      if (candidate === path) continue;
      if (path.startsWith(candidate + "/") && (!parent || candidate.length > parent.path.length)) {
        parent = nodeMap.get(candidate) || null;
      }
    }

    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ── Environment Group ───────────────────────────────────────────────

const ENV_ICONS: Record<string, typeof Desktop> = { local: Desktop, cloud: Cloud, ssh: Terminal, container: Cube };

function EnvironmentGroup(props: {
  hostname: string;
  envType: string;
  sessions: SessionState[];
  selectedIds?: string[];
  onSelect?: (id: string) => void;
}) {
  const [open, setOpen] = createSignal(true);
  const EnvIcon = () => ENV_ICONS[props.envType] || Desktop;

  const projectTree = createMemo(() => buildProjectTree(props.sessions));

  return (
    <div>
      <button
        onClick={() => setOpen(!open())}
        class="flex items-center gap-2 px-1 py-1.5 w-full hover:bg-panel/30 transition-colors rounded-sm"
      >
        {open() ? <CaretDown size={10} class="text-text-sub" /> : <CaretRight size={10} class="text-text-sub" />}
        {(() => {
          const I = EnvIcon();
          return <I size={14} class="text-text-label" />;
        })()}
        <span class="text-[11px] font-bold text-text-primary truncate">{props.hostname}</span>
        <span class="ml-auto flex items-center gap-1">
          <Pulse size={10} class="text-safe" />
          <span class="text-[9px] text-text-label">{props.sessions.length}</span>
        </span>
      </button>
      <Show when={open()}>
        <div class="space-y-1.5 mt-1">
          <For each={projectTree()}>
            {(node) => <ProjectGroupView node={node} selectedIds={props.selectedIds} onSelect={props.onSelect} />}
          </For>
        </div>
      </Show>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────

export const AgentMap: Component<{
  sessions: Record<string, SessionState>;
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  onPurge?: () => void;
}> = (props) => {
  const [hideInactive, setHideInactive] = createSignal(true);

  const allSessions = createMemo(() => {
    const all = Object.values(props.sessions);
    if (!hideInactive()) return all;
    const now = Date.now();
    // Show active + sessions with any activity, hide empty offline/done and long-idle sessions
    return all.filter((s) => {
      // Always show sessions with recent activity (last 10 minutes) regardless of status
      if (now - s.last_event_at < 600_000) return true;
      // Hide empty offline/done sessions with no tool activity
      if (INACTIVE_STATUSES.has(s.status)) {
        if (s.edit_count > 0 || s.command_count > 0 || s.read_count > 0 || s.search_count > 0) return true;
        return false;
      }
      // Hide sessions idle for more than 30 minutes (catches stale "thinking" test sessions)
      if (now - s.last_event_at > 1_800_000) return false;
      return true;
    });
  });

  const hiddenCount = createMemo(() => Object.values(props.sessions).length - allSessions().length);

  const envGroups = createMemo(() => {
    const map = new Map<string, SessionState[]>();
    for (const s of allSessions()) {
      // Normalize github:XXXXX machine IDs to "Local"
      const raw = s.machine_id || "unknown";
      const key = raw.startsWith("github:") ? "Local" : raw;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries());
  });

  return (
    <div class="flex flex-col h-full">
      {/* Filter toggle */}
      <div class="flex items-center gap-2 px-1 pb-2">
        <button
          onClick={() => setHideInactive(!hideInactive())}
          class="flex items-center gap-1.5 text-[9px] text-text-sub hover:text-text-primary transition-colors"
          title={hideInactive() ? "Show all sessions" : "Hide inactive sessions"}
        >
          {hideInactive() ? <EyeSlash size={11} /> : <Eye size={11} />}
          {hideInactive() && hiddenCount() > 0
            ? `Show ${hiddenCount()} inactive`
            : hideInactive()
              ? "Show inactive"
              : "Hide inactive"}
        </button>
      </div>

      <Show
        when={allSessions().length > 0}
        fallback={
          <div class="flex flex-col items-center justify-center flex-1 gap-2 py-12">
            <Desktop size={28} class="text-text-sub" />
            <span class="text-[12px] text-text-dim">
              {hiddenCount() > 0 ? `${hiddenCount()} inactive sessions hidden` : "No agents connected"}
            </span>
            <Show when={hiddenCount() > 0}>
              <button onClick={() => setHideInactive(false)} class="text-[10px] text-safe hover:underline">
                Show all
              </button>
            </Show>
          </div>
        }
      >
        <div class="space-y-2">
          <For each={envGroups()}>
            {([hostname, sessions]) => (
              <EnvironmentGroup
                hostname={hostname}
                envType={sessions[0]?.source || "local"}
                sessions={sessions}
                selectedIds={props.selectedIds}
                onSelect={props.onSelect}
              />
            )}
          </For>
        </div>
      </Show>
    </div>
  );
};
