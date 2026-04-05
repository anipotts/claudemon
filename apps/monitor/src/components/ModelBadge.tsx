import type { Component } from "solid-js";

const MODEL_COLORS: Record<string, string> = {
  opus: "#c9a96e",
  sonnet: "#7b9fbf",
  haiku: "#8a8478",
};

export const ModelBadge: Component<{ model: string }> = (props) => {
  const info = () => {
    const m = props.model;
    const family = Object.keys(MODEL_COLORS).find((k) => m.includes(k));
    const color = family ? MODEL_COLORS[family] : "#6b6560";
    const text = m.replace("claude-", "").replace(/-\d+$/, "");
    return { text, color };
  };
  return (
    <span class="text-[9px] font-mono" style={{ color: info().color }}>
      {info().text}
    </span>
  );
};
