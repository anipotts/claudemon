import type { Component } from "solid-js";
import { formatTime, formatTimeFull } from "../utils/time";

export const Timestamp: Component<{ ts: number; class?: string }> = (props) => {
  return (
    <span
      class={`cursor-default select-all ${props.class || "text-[9px] text-text-sub"}`}
      title={formatTimeFull(props.ts)}
    >
      {formatTime(props.ts)}
    </span>
  );
};
