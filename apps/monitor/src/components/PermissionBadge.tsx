import type { Component } from "solid-js";

// Permission mode colors from Claude Code source (src/utils/theme.ts)
const MODE_CONFIG: Record<string, { label: string; short: string; symbol: string; color: string }> = {
  default: { label: "Ask before edits", short: "ask", symbol: "", color: "#e8e0d4" },
  plan: { label: "Plan mode", short: "plan", symbol: "\u23F8", color: "#006666" },
  acceptEdits: { label: "Accept edits", short: "accept", symbol: "\u23F5\u23F5", color: "#8700ff" },
  bypassPermissions: { label: "Bypass permissions", short: "bypass", symbol: "\u23F5\u23F5", color: "#ab2b3f" },
  dontAsk: { label: "Don't ask", short: "auto", symbol: "\u23F5\u23F5", color: "#ab2b3f" },
  auto: { label: "Auto mode", short: "auto", symbol: "\u23F5\u23F5", color: "#966c1e" },
};

const FALLBACK = { label: "Unknown", short: "?", symbol: "", color: "#6b6560" };

export const PermissionBadge: Component<{
  mode: string;
  compact?: boolean;
}> = (props) => {
  const config = () => MODE_CONFIG[props.mode] || FALLBACK;

  return (
    <span
      class="inline-flex items-center gap-1 font-mono rounded-sm text-[9px] font-bold px-1.5 py-0.5"
      style={{
        color: config().color,
        background: config().color + "18",
        border: `1px solid ${config().color}30`,
      }}
      title={config().label}
    >
      {config().symbol && <span class="text-[8px]">{config().symbol}</span>}
      {props.compact ? config().short : config().label}
    </span>
  );
};
