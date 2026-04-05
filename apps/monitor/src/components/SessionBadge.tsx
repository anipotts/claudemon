import type { Component, JSX } from "solid-js";
import { Show } from "solid-js";
import type { SessionStatus } from "../../../../packages/types/monitor";

// Consistent session color hashing — same color for same session everywhere
const SESSION_COLORS = ["#a3b18a", "#c9a96e", "#7ea8be", "#b07bac", "#8a8478", "#7b9fbf"];

export function hashSessionColor(sessionId: string): string {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) {
    hash = ((hash << 5) - hash + sessionId.charCodeAt(i)) | 0;
  }
  return SESSION_COLORS[Math.abs(hash) % SESSION_COLORS.length];
}

const STATUS_DOT_COLORS: Record<SessionStatus, string> = {
  working: "#a3b18a",
  thinking: "#7b9fbf",
  waiting: "#c9a96e",
  done: "#666",
  error: "#b85c4a",
  offline: "#4a4640",
};

/**
 * Unified session identifier badge used across Agent Map, tabs, activity feed,
 * and session detail. Always shows the same color for the same session ID.
 *
 * Display priority:
 * 1. project_name (always shown if available)
 * 2. session_id first 8 chars (shown as secondary, or primary if no project_name)
 * 3. Full session_id in tooltip on hover
 */
export const SessionBadge: Component<{
  sessionId: string;
  projectName?: string;
  status?: SessionStatus;
  onClick?: () => void;
  size?: "sm" | "md";
  showStatus?: boolean;
  class?: string;
  style?: JSX.CSSProperties;
}> = (props) => {
  const color = () => hashSessionColor(props.sessionId);
  const size = () => props.size || "sm";
  const idShort = () => props.sessionId.slice(0, 8);

  return (
    <span
      class={`inline-flex items-center gap-1 font-mono cursor-pointer rounded-sm transition-colors hover:brightness-125 overflow-hidden ${props.class || ""}`}
      style={{
        color: color(),
        background: color() + "12",
        padding: size() === "md" ? "2px 6px" : "1px 4px",
        "font-size": size() === "md" ? "10px" : "8px",
        "font-weight": "700",
        "letter-spacing": "0.3px",
        ...props.style,
      }}
      onClick={props.onClick}
      title={`Session: ${props.sessionId}\nProject: ${props.projectName || "unknown"}`}
    >
      <Show when={props.showStatus && props.status}>
        <span
          class="w-1.5 h-1.5 rounded-full shrink-0"
          style={{
            background: STATUS_DOT_COLORS[props.status!] || "#4a4640",
            "box-shadow":
              props.status === "working" || props.status === "thinking"
                ? `0 0 4px ${STATUS_DOT_COLORS[props.status!]}`
                : "none",
          }}
        />
      </Show>
      <Show when={props.projectName}>
        <span class="truncate">{props.projectName}</span>
        <span style={{ opacity: "0.5" }} class="shrink-0">
          {idShort()}
        </span>
      </Show>
      <Show when={!props.projectName}>
        <span class="shrink-0">{idShort()}</span>
      </Show>
    </span>
  );
};
