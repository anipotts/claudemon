import { type Component, mergeProps } from "solid-js";

export type ClaudeMonPose =
  | "default"
  | "watching"
  | "scanning-left"
  | "scanning-right"
  | "alert"
  | "sleep"
  | "celebrate";

interface ClaudeMonIconProps {
  pose?: ClaudeMonPose;
  size?: number;
  class?: string;
}

const BODY = "#D77757";
const EYE = "#000000";

const Eyes: Component<{ pose: ClaudeMonPose }> = (props) => {
  switch (props.pose) {
    case "watching":
      return (
        <>
          <rect x="80" y="94" width="26" height="30" rx="7" fill={EYE} />
          <rect x="150" y="94" width="26" height="30" rx="7" fill={EYE} />
        </>
      );
    case "scanning-left":
      return (
        <>
          <rect x="72" y="88" width="26" height="40" rx="7" fill={EYE} />
          <rect x="142" y="88" width="26" height="40" rx="7" fill={EYE} />
        </>
      );
    case "scanning-right":
      return (
        <>
          <rect x="88" y="88" width="26" height="40" rx="7" fill={EYE} />
          <rect x="158" y="88" width="26" height="40" rx="7" fill={EYE} />
        </>
      );
    case "alert":
      return (
        <>
          <rect x="76" y="82" width="30" height="48" rx="9" fill={EYE} />
          <rect x="150" y="82" width="30" height="48" rx="9" fill={EYE} />
        </>
      );
    case "sleep":
      return (
        <>
          <rect x="80" y="106" width="26" height="6" rx="3" fill={EYE} />
          <rect x="150" y="106" width="26" height="6" rx="3" fill={EYE} />
        </>
      );
    case "celebrate":
      return (
        <>
          <path d="M80,112 Q93,92 106,112" stroke={EYE} stroke-width="5" stroke-linecap="round" fill="none" />
          <path d="M150,112 Q163,92 176,112" stroke={EYE} stroke-width="5" stroke-linecap="round" fill="none" />
        </>
      );
    default:
      return (
        <>
          <rect x="80" y="88" width="26" height="40" rx="7" fill={EYE} />
          <rect x="150" y="88" width="26" height="40" rx="7" fill={EYE} />
        </>
      );
  }
};

const Arms: Component<{ raised: boolean }> = (props) => {
  if (props.raised) {
    return (
      <>
        <ellipse cx="18" cy="92" rx="14" ry="26" fill={BODY} />
        <ellipse cx="238" cy="92" rx="14" ry="26" fill={BODY} />
      </>
    );
  }
  return (
    <>
      <ellipse cx="18" cy="130" rx="14" ry="26" fill={BODY} />
      <ellipse cx="238" cy="130" rx="14" ry="26" fill={BODY} />
    </>
  );
};

export const ClaudeMonIcon: Component<ClaudeMonIconProps> = (rawProps) => {
  const props = mergeProps({ pose: "default" as ClaudeMonPose, size: 32 }, rawProps);
  const raised = () => props.pose === "alert" || props.pose === "celebrate";

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={props.size}
      height={props.size}
      class={props.class}
    >
      <path
        d="M128,44 C204,44 228,76 228,120 C228,168 204,196 128,196 C52,196 28,168 28,120 C28,76 52,44 128,44 Z"
        fill={BODY}
      />
      <Arms raised={raised()} />
      <Eyes pose={props.pose} />
      <ellipse cx="100" cy="200" rx="18" ry="12" fill={BODY} />
      <ellipse cx="156" cy="200" rx="18" ry="12" fill={BODY} />
    </svg>
  );
};
