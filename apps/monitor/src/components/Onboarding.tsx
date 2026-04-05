import { type Component, createSignal, Show, For, createMemo } from "solid-js";
import {
  ShieldCheck,
  Copy,
  Check,
} from "./Icons";

const API_URL =
  import.meta.env.VITE_MONITOR_API_URL || "https://api.claudemon.com";

// ── Copy button ─────────────────────────────────────────────────────

function CopyBtn(props: { text: string }) {
  const [copied, setCopied] = createSignal(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(props.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} class="p-1 rounded transition-all" title="Copy">
      {copied() ? <Check size={13} class="text-safe" /> : <Copy size={13} class="text-text-sub hover:text-text-primary" />}
    </button>
  );
}

// ── Code block ──────────────────────────────────────────────────────

function CodeBlock(props: { code: string; label?: string; lang?: "bash" | "json"; maxH?: string }) {
  const lines = () => props.code.split("\n");

  const colorize = (line: string): Array<{ text: string; color?: string }> => {
    if (props.lang === "json") return colorizeJson(line);
    if (line.trimStart().startsWith("#")) return [{ text: line, color: "#5c6370" }];
    return [{ text: line }];
  };

  return (
    <div class="group relative flex-1 min-h-0 flex flex-col">
      <Show when={props.label}>
        <div class="text-[10px] text-text-sub uppercase tracking-wider mb-1">{props.label}</div>
      </Show>
      <div class={`relative bg-[#0e0d0c] border border-panel-border/50 rounded flex-1 min-h-0 overflow-auto ${props.maxH || ""}`}>
        <pre class="px-3 py-2.5 text-[11.5px] leading-[1.6] font-mono whitespace-pre">
          <For each={lines()}>
            {(line, i) => (
              <>
                <For each={colorize(line)}>
                  {(tok) => <span style={tok.color ? { color: tok.color } : {}}>{tok.text}</span>}
                </For>
                {i() < lines().length - 1 ? "\n" : ""}
              </>
            )}
          </For>
        </pre>
        <div class="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyBtn text={props.code} />
        </div>
      </div>
    </div>
  );
}

function colorizeJson(line: string): Array<{ text: string; color?: string }> {
  const tokens: Array<{ text: string; color?: string }> = [];
  let i = 0;
  const s = line;
  while (i < s.length) {
    if (s[i] === " " || s[i] === "\t") {
      let j = i;
      while (j < s.length && (s[j] === " " || s[j] === "\t")) j++;
      tokens.push({ text: s.slice(i, j) });
      i = j;
    } else if (s[i] === '"') {
      let j = i + 1;
      while (j < s.length && s[j] !== '"') { if (s[j] === "\\") j++; j++; }
      j++;
      const str = s.slice(i, j);
      let k = j;
      while (k < s.length && s[k] === " ") k++;
      tokens.push({ text: str, color: s[k] === ":" ? "#e06c75" : "#98c379" });
      i = j;
    } else if (s.slice(i).match(/^(true|false|null)/)) {
      const m = s.slice(i).match(/^(true|false|null)/)!;
      tokens.push({ text: m[0], color: "#d19a66" });
      i += m[0].length;
    } else if ("{}[]:,".includes(s[i])) {
      tokens.push({ text: s[i], color: "#5c6370" });
      i++;
    } else {
      tokens.push({ text: s[i] });
      i++;
    }
  }
  return tokens;
}

// ── Field config ────────────────────────────────────────────────────

interface FieldConfig {
  id: string;
  label: string;
  required?: boolean;
  default: boolean;
  jqField: string;
}

const FIELDS: FieldConfig[] = [
  { id: "session_id", label: "session_id", required: true, default: true, jqField: "session_id: .session_id" },
  { id: "machine_id", label: "machine_id", required: true, default: true, jqField: "machine_id: $mid" },
  { id: "project_path", label: "project_path", default: true, jqField: "project_path: $pp" },
  { id: "branch", label: "branch", default: true, jqField: "branch: $br" },
  { id: "hook_event_name", label: "hook_event_name", required: true, default: true, jqField: "hook_event_name: .hook_event_name" },
  { id: "tool_name", label: "tool_name", default: true, jqField: "tool_name: .tool_name" },
  { id: "tool_input", label: "tool_input", default: true, jqField: "tool_input: .tool_input" },
  { id: "tool_response", label: "tool_response", default: false, jqField: "tool_response: (.tool_response // null)" },
  { id: "model", label: "model", default: true, jqField: "model: (.model // null)" },
];

// ── Main ────────────────────────────────────────────────────────────

interface User { sub: string; name: string; login: string; avatar_url: string }

export const Onboarding: Component<{ apiUrl: string; user: User | null; authLoading: boolean }> = (props) => {
  const [apiKey, setApiKey] = createSignal<string | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = createSignal(false);
  const [enabledFields, setEnabledFields] = createSignal<Record<string, boolean>>(
    Object.fromEntries(FIELDS.map((f) => [f.id, f.default]))
  );

  const toggleField = (id: string) => {
    const field = FIELDS.find((f) => f.id === id);
    if (field?.required) return;
    setEnabledFields((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const createApiKey = async () => {
    setApiKeyLoading(true);
    try {
      const res = await fetch(`${props.apiUrl}/auth/api-keys`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "onboarding" }),
      });
      if (res.ok) { const data = await res.json(); setApiKey(data.key); }
    } catch {}
    setApiKeyLoading(false);
  };

  const hookScript = createMemo(() => {
    const enabled = enabledFields();
    const jqFields = FIELDS.filter((f) => enabled[f.id]).map((f) => f.jqField);
    const key = apiKey() || "${CLAUDEMON_API_KEY:-}";
    return `#!/usr/bin/env bash
# ClaudeMon Hook — generated at app.claudemon.com
set -euo pipefail
API_URL="\${CLAUDEMON_API_URL:-https://api.claudemon.com}"
API_KEY="${key}"
MID="$(hostname -s | tr '[:upper:]' '[:lower:]')"
TS="$(date +%s)000"
INPUT="$(cat)"
BR=""; PP="$PWD"
if git rev-parse --is-inside-work-tree &>/dev/null; then
  BR="$(git branch --show-current 2>/dev/null || true)"
  PP="$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")"
fi
PAYLOAD="$(echo "$INPUT" | jq -c \\
  --arg mid "$MID" --argjson ts "$TS" \\
  --arg pp "$PP" --arg br "$BR" \\
  '{${jqFields.join(", ")}, timestamp: $ts}' \\
  | jq -c 'with_entries(select(.value != null))'
)"
curl -sf -X POST "$API_URL/events" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $API_KEY" \\
  -d "$PAYLOAD" --max-time 2 >/dev/null 2>&1 || true
exit 0`;
  });

  const settingsJson = createMemo(() => {
    const h = { type: "command", command: "bash ~/.claudemon-hook.sh", async: true };
    const e = [{ matcher: "", hooks: [h] }];
    return JSON.stringify({ hooks: { PreToolUse: e, PostToolUse: e, Notification: e, Stop: e } }, null, 2);
  });

  const ready = () => !!apiKey();

  return (
    <div class="flex-1 flex flex-col overflow-hidden">
      {/* 3-column grid fills viewport below header */}
      <div class="flex-1 flex min-h-0">

        {/* ── COL 1: Auth + API key ──────────────────────────── */}
        <div class="flex-1 border-r border-panel-border/30 p-5 flex flex-col overflow-y-auto">
          <div class="flex items-baseline gap-2 mb-4">
            <span class="text-[13px] font-bold text-text-label">1</span>
            <h2 class="text-[13px] font-bold uppercase tracking-wider text-text-label">Get API key</h2>
          </div>

          <Show when={!props.authLoading}>
            <Show when={props.user} fallback={
              <div>
                <a
                  href={`${props.apiUrl}/auth/login?redirect=${encodeURIComponent(window.location.href)}`}
                  class="inline-flex items-center gap-2 bg-[#161b22] border border-[#30363d] rounded px-4 py-2 text-[13px] text-white hover:bg-[#1c2128] transition-colors"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
                  Sign in with GitHub
                </a>
              </div>
            }>
              {(u) => (
                <div>
                  <div class="flex items-center gap-2 mb-4 text-[13px]">
                    <img src={u().avatar_url} alt={u().login} class="w-5 h-5 rounded-full border border-panel-border" />
                    <span class="text-text-label">{u().login}</span>
                    <Check size={12} class="text-safe" />
                  </div>
                  <Show when={!apiKey()} fallback={
                    <div class="flex items-center gap-2 bg-[#0e0d0c] border border-panel-border/50 rounded px-3 py-2 mb-4">
                      <code class="text-[12px] text-safe flex-1 truncate font-mono">{apiKey()}</code>
                      <CopyBtn text={apiKey()!} />
                    </div>
                  }>
                    <button
                      onClick={createApiKey}
                      disabled={apiKeyLoading()}
                      class="flex items-center gap-2 bg-safe/15 border border-safe/30 rounded px-4 py-2 text-[13px] font-bold text-safe hover:bg-safe/25 transition-colors disabled:opacity-50 cursor-pointer mb-4"
                    >
                      {apiKeyLoading() ? "Creating..." : "Create API key"}
                    </button>
                  </Show>
                </div>
              )}
            </Show>
          </Show>

          <div class="border-t border-panel-border/30 my-4" />

          <div class="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-dim mb-3">
            <span class="flex items-center gap-1"><ShieldCheck size={10} class="text-safe" /> Ephemeral</span>
            <span class="flex items-center gap-1"><ShieldCheck size={10} class="text-safe" /> Open source</span>
            <span class="flex items-center gap-1"><ShieldCheck size={10} class="text-safe" /> Self-hostable</span>
          </div>
          <p class="text-[12px] text-text-dim">
            <span class="text-attack font-bold">Never sent:</span> file contents, API keys, env vars, your conversation.
          </p>
        </div>

        {/* ── COL 2: Choose fields ───────────────────────────── */}
        <div class={`flex-1 border-r border-panel-border/30 p-5 flex flex-col overflow-y-auto transition-opacity ${ready() ? "" : "opacity-25 pointer-events-none"}`}>
          <div class="flex items-baseline gap-2 mb-4">
            <span class="text-[13px] font-bold text-text-label">2</span>
            <h2 class="text-[13px] font-bold uppercase tracking-wider text-text-label">Choose fields</h2>
          </div>

          <div class="space-y-0.5 mb-4">
            <For each={FIELDS}>
              {(field) => {
                const on = () => enabledFields()[field.id];
                return (
                  <button
                    onClick={() => toggleField(field.id)}
                    class={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded text-left transition-colors ${
                      field.required ? "cursor-default" : "cursor-pointer hover:bg-card/80"
                    }`}
                  >
                    <div class={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      on() ? "bg-safe/20 border-safe/50" : "border-panel-border/60"
                    }`}>
                      <Show when={on()}><Check size={9} class="text-safe" /></Show>
                    </div>
                    <span class={`text-[13px] font-mono ${on() ? "text-text-primary" : "text-text-sub line-through"}`}>
                      {field.label}
                    </span>
                    <Show when={field.required}>
                      <span class="text-[9px] text-text-sub uppercase tracking-wider ml-auto">req</span>
                    </Show>
                  </button>
                );
              }}
            </For>
          </div>
        </div>

        {/* ── COL 3: Install (hook + settings) ───────────────── */}
        <div class={`flex-1 p-5 flex flex-col overflow-hidden transition-opacity ${ready() ? "" : "opacity-25 pointer-events-none"}`}>
          <div class="flex items-baseline gap-2 mb-4">
            <span class="text-[13px] font-bold text-text-label">3</span>
            <h2 class="text-[13px] font-bold uppercase tracking-wider text-text-label">Install</h2>
          </div>

          <div class="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto">
            <CodeBlock code={hookScript()} label="Save as ~/.claudemon-hook.sh" lang="bash" />
            <CodeBlock code={settingsJson()} label="Add to ~/.claude/settings.json" lang="json" />
          </div>

          <div class="mt-3 flex items-center gap-2.5 text-[12px]">
            <span class="w-2 h-2 rounded-full bg-safe animate-pulse" />
            <span class="text-text-dim">Listening for sessions...</span>
          </div>
        </div>

      </div>
    </div>
  );
};
