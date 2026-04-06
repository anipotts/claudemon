import type { Component } from "solid-js";
import { SmartTooltip } from "./SmartTooltip";

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

function fileExtLabel(path: string): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    tsx: "TypeScript JSX",
    ts: "TypeScript",
    jsx: "React JSX",
    js: "JavaScript",
    css: "Stylesheet",
    json: "JSON",
    md: "Markdown",
    html: "HTML",
    toml: "TOML Config",
    sh: "Shell Script",
    py: "Python",
  };
  return ext ? map[ext] || null : null;
}

export const FileBadge: Component<{ path: string }> = (props) => {
  const info = () => classifyPath(props.path);
  const dir = () => {
    const parts = props.path.split("/");
    return parts.length > 1 ? parts.slice(0, -1).join("/") + "/" : "";
  };
  const filename = () => props.path.split("/").pop() || props.path;
  const extLabel = () => fileExtLabel(props.path);

  return (
    <SmartTooltip
      content={
        <div>
          <div class="tt-dim" style={{ "word-break": "break-all" }}>
            {dir()}
            <span class="tt-value">{filename()}</span>
          </div>
          <div class="tt-row">
            {extLabel() && <span class="tt-label" style={{ margin: "0" }}>{extLabel()}</span>}
            {info().type !== "default" && (
              <span class="tt-label" style={{ margin: "0", color: "var(--text-sub)" }}>{info().type}</span>
            )}
          </div>
        </div>
      }
    >
      <span class={`file-badge file-badge-${info().type}`}>
        {info().label && <span class="text-[8px] uppercase tracking-wider">{info().label}</span>}
        <span>{info().filename}</span>
      </span>
    </SmartTooltip>
  );
};
