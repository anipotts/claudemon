import { type Component, For, Show } from "solid-js";
import { Warning, Lightning } from "./Icons";
import { FileBadge } from "./FileBadge";
import { hashSessionColor } from "./SessionBadge";

export interface ConflictData {
  id: string;
  filePath: string;
  sessionIds: string[];
  detectedAt: number;
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

function ConflictRow(props: { conflict: ConflictData }) {
  const c = () => props.conflict;
  // Filter out unknown-* session IDs
  const validSessions = () => c().sessionIds.filter((s) => !s.startsWith("unknown"));

  return (
    <Show when={validSessions().length > 1}>
      <div class="px-3 py-2 border border-attack/30 rounded-sm bg-attack/5">
        <div class="mb-1.5">
          <FileBadge path={c().filePath} />
        </div>
        <div class="flex flex-wrap gap-1 mb-1">
          <For each={validSessions()}>
            {(sid) => {
              const color = hashSessionColor(sid);
              return (
                <span
                  class="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-sm"
                  style={{ color, background: color + "15", border: `1px solid ${color}30` }}
                >
                  {sid.slice(0, 8)}
                </span>
              );
            }}
          </For>
        </div>
        <div class="flex items-center gap-2 text-[9px]">
          <Lightning size={9} class="text-attack" />
          <span class="text-attack">Both editing</span>
          <span class="text-text-sub ml-auto">{timeAgo(c().detectedAt)}</span>
        </div>
      </div>
    </Show>
  );
}

export const ConflictPanel: Component<{ conflicts: ConflictData[] }> = (props) => {
  // Only show conflicts with 2+ valid (non-unknown) sessions
  const validConflicts = () =>
    props.conflicts.filter((c) => c.sessionIds.filter((s) => !s.startsWith("unknown")).length > 1);

  return (
    <Show
      when={validConflicts().length > 0}
      fallback={
        <div class="flex items-center gap-2 py-3 px-3 text-[11px] text-text-sub">
          <Warning size={14} />
          <span>No conflicts detected</span>
        </div>
      }
    >
      <div class="space-y-2">
        <For each={validConflicts()}>{(c) => <ConflictRow conflict={c} />}</For>
      </div>
    </Show>
  );
};
