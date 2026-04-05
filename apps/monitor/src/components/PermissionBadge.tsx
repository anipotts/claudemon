import type { Component } from "solid-js";

// Permission mode colors mapped from Claude Code source (src/utils/permissions/PermissionMode.ts)
// CC uses color keys: text, planMode, autoAccept, error, warning — mapped to ClaudeMon palette
const MODE_CONFIG: Record<string, { label: string; short: string; symbol: string; color: string }> = {
  default: { label: "Default", short: "default", symbol: "", color: "#8a8478" },
  plan: { label: "Plan mode", short: "plan", symbol: "\u23F8", color: "#7b9fbf" },
  acceptEdits: { label: "Accept edits", short: "accept", symbol: "\u23F5\u23F5", color: "#c9a96e" },
  bypassPermissions: { label: "Bypass permissions", short: "bypass", symbol: "\u23F5\u23F5", color: "#b85c4a" },
  dontAsk: { label: "Don't ask", short: "dontask", symbol: "\u23F5\u23F5", color: "#b85c4a" },
  auto: { label: "Auto mode", short: "auto", symbol: "\u23F5\u23F5", color: "#c9a96e" },
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
