import type { Component } from "solid-js";

type BadgeType = "global" | "plan" | "src" | "config" | "test" | "default";

function classifyPath(path: string): { type: BadgeType; label: string; filename: string } {
  const parts = path.split("/");
  const filename = parts[parts.length - 1] || path;

  if (path.includes(".claude/plans/")) return { type: "plan", label: "plan", filename };
  if (path.includes(".claude/")) return { type: "global", label: "global", filename };
  if (/\.(test|spec)\.\w+$/.test(filename)) return { type: "test", label: "test", filename };
  if (/^(package\.json|tsconfig\.json|wrangler\.(toml|jsonc)|vite\.config\.\w+|\.eslintrc)/.test(filename))
    return { type: "config", label: "config", filename };
  if (path.includes("/src/")) {
    const srcIdx = parts.indexOf("src");
    return { type: "src", label: "src", filename: parts.slice(srcIdx + 1).join("/") };
  }
  return { type: "default", label: "", filename: parts.slice(-2).join("/") };
}

export const FileBadge: Component<{ path: string }> = (props) => {
  const info = () => classifyPath(props.path);

  return (
    <span class={`file-badge file-badge-${info().type}`}>
      {info().label && <span class="text-[8px] uppercase tracking-wider">{info().label}</span>}
      <span>{info().filename}</span>
      <span class="tooltip">{props.path}</span>
    </span>
  );
};
