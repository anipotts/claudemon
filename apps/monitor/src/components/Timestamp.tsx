import { type Component, createSignal, createEffect, onCleanup } from "solid-js";
import { timeAgo } from "../utils/time";
import { formatTimeFull } from "../utils/time";

export const Timestamp: Component<{ ts: number; class?: string }> = (props) => {
  const [relative, setRelative] = createSignal(timeAgo(props.ts));

  createEffect(() => {
    // Re-read props.ts to track reactively
    const ts = props.ts;
    setRelative(timeAgo(ts));
    const interval = setInterval(() => setRelative(timeAgo(ts)), 1000);
    onCleanup(() => clearInterval(interval));
  });

  return (
    <span class={`cursor-default ${props.class || "text-[9px] text-text-sub"}`} title={formatTimeFull(props.ts)}>
      {relative()}
    </span>
  );
};
