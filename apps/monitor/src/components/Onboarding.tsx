import { type Component, createSignal, Show, For, createMemo } from "solid-js";
import { ShieldCheck, Copy, Check, Eye, Lightning, TreeStructure } from "./Icons";

const API_URL = import.meta.env.VITE_MONITOR_API_URL || "https://api.claudemon.com";

// ── Copy button ─────────────────────────────────────────────────────

function CopyBtn(props: { text: string; class?: string }) {
  const [copied, setCopied] = createSignal(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(props.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      class={`p-1.5 rounded transition-all ${props.class || ""}`}
      title="Copy"
    >
      {copied() ? <Check size={14} class="text-safe" /> : <Copy size={14} class="text-text-sub hover:text-text-primary" />}
    </button>
  );
}

// ── Code block with copy ────────────────────────────────────────────

function CodeBlock(props: { code: string; label?: string; lang?: "bash" | "json" }) {
  // SolidJS-safe syntax highlighting: build DOM nodes, not innerHTML
  const lines = () => props.code.split("\n");

  const colorize = (line: string): Array<{ text: string; color?: string }> => {
    if (props.lang === "json") {
      return colorizeJson(line);
    }
    // bash: just highlight comments
    if (line.trimStart().startsWith("#")) {
      return [{ text: line, color: "#5c6370" }];
    }
    return [{ text: line }];
  };

  return (
    <div class="group relative">
      <Show when={props.label}>
        <div class="text-[11px] text-text-sub uppercase tracking-wider mb-1.5">{props.label}</div>
      </Show>
      <div class="relative bg-[#0e0d0c] border border-panel-border/50 rounded overflow-x-auto">
        <pre class="px-4 py-3 text-[13px] leading-[1.65] font-mono whitespace-pre">
          <For each={lines()}>
            {(line, i) => (
              <>
                <For each={colorize(line)}>
                  {(tok) => (
                    <span style={tok.color ? { color: tok.color } : {}}>{tok.text}</span>
                  )}
                </For>
                {i() < lines().length - 1 ? "\n" : ""}
              </>
            )}
          </For>
        </pre>
        <div class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <CopyBtn text={props.code} />
        </div>
      </div>
    </div>
  );
}

// Simple JSON tokenizer for one line
function colorizeJson(line: string): Array<{ text: string; color?: string }> {
  const tokens: Array<{ text: string; color?: string }> = [];
  let i = 0;
  const s = line;

  while (i < s.length) {
    // whitespace
    if (s[i] === " " || s[i] === "\t") {
      let j = i;
      while (j < s.length && (s[j] === " " || s[j] === "\t")) j++;
      tokens.push({ text: s.slice(i, j) });
      i = j;
      continue;
    }
    // string
    if (s[i] === '"') {
      let j = i + 1;
      while (j < s.length && s[j] !== '"') { if (s[j] === "\\") j++; j++; }
      j++; // closing quote
      const str = s.slice(i, j);
      // check if it's a key (followed by :)
      let k = j;
      while (k < s.length && s[k] === " ") k++;
      const isKey = s[k] === ":";
      tokens.push({ text: str, color: isKey ? "#e06c75" : "#98c379" });
      i = j;
      continue;
    }
    // boolean/null
    if (s.slice(i).match(/^(true|false|null)/)) {
      const m = s.slice(i).match(/^(true|false|null)/)!;
      tokens.push({ text: m[0], color: "#d19a66" });
      i += m[0].length;
      continue;
    }
    // number
    if (s[i] >= "0" && s[i] <= "9") {
      let j = i;
      while (j < s.length && s[j] >= "0" && s[j] <= "9") j++;
      tokens.push({ text: s.slice(i, j), color: "#d19a66" });
      i = j;
      continue;
    }
    // punctuation
    if ("{}[]:,".includes(s[i])) {
      tokens.push({ text: s[i], color: "#5c6370" });
      i++;
      continue;
    }
    // anything else
    tokens.push({ text: s[i] });
    i++;
  }
  return tokens;
}

// ── Data field toggles ──────────────────────────────────────────────

interface FieldConfig {
  id: string;
  label: string;
  desc: string;
  required?: boolean; // can't be toggled off
  default: boolean;
  jqField: string; // jq expression
}

const FIELDS: FieldConfig[] = [
  { id: "session_id", label: "session_id", desc: "which session", required: true, default: true, jqField: "session_id: .session_id" },
  { id: "machine_id", label: "machine_id", desc: "which machine", required: true, default: true, jqField: "machine_id: $mid" },
  { id: "project_path", label: "project_path", desc: "project directory", default: true, jqField: "project_path: $pp" },
  { id: "branch", label: "branch", desc: "git branch", default: true, jqField: "branch: $br" },
  { id: "hook_event_name", label: "hook_event_name", desc: "event type", required: true, default: true, jqField: "hook_event_name: .hook_event_name" },
  { id: "tool_name", label: "tool_name", desc: "which tool", default: true, jqField: "tool_name: .tool_name" },
  { id: "tool_input", label: "tool_input", desc: "tool arguments", default: true, jqField: "tool_input: .tool_input" },
  { id: "tool_response", label: "tool_response", desc: "tool output", default: false, jqField: "tool_response: (.tool_response // null)" },
  { id: "model", label: "model", desc: "model name", default: true, jqField: "model: (.model // null)" },
];

// ── Main onboarding ─────────────────────────────────────────────────

interface User {
  sub: string;
  name: string;
  login: string;
  avatar_url: string;
}

export const Onboarding: Component<{ apiUrl: string; user: User | null; authLoading: boolean }> = (props) => {
  const [apiKey, setApiKey] = createSignal<string | null>(null);
  const [apiKeyLoading, setApiKeyLoading] = createSignal(false);

  // Field toggles — initialized from defaults
  const [enabledFields, setEnabledFields] = createSignal<Record<string, boolean>>(
    Object.fromEntries(FIELDS.map(f => [f.id, f.default]))
  );

  const toggleField = (id: string) => {
    const field = FIELDS.find(f => f.id === id);
    if (field?.required) return;
    setEnabledFields(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const createApiKey = async () => {
    setApiKeyLoading(true);
    try {
      const res = await fetch(`${props.apiUrl}/auth/api-keys`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "onboarding" }),
      });
      if (res.ok) {
        const data = await res.json();
        setApiKey(data.key);
      }
    } catch {}
    setApiKeyLoading(false);
  };

  // Generate the hook script dynamically based on toggled fields
  const hookScript = createMemo(() => {
    const enabled = enabledFields();
    const jqFields = FIELDS
      .filter(f => enabled[f.id])
      .map(f => f.jqField);

    const key = apiKey() || "${CLAUDEMON_API_KEY:-}";

    return `#!/usr/bin/env bash
# ClaudeMon Hook — generated at app.claudemon.com
# Every field below is one you opted in to. Nothing else is sent.
set -euo pipefail

API_URL="\${CLAUDEMON_API_URL:-https://api.claudemon.com}"
API_KEY="${key}"
MACHINE_ID="$(hostname -s | tr '[:upper:]' '[:lower:]')"
TIMESTAMP="$(date +%s)000"
INPUT="$(cat)"

BRANCH=""; PROJECT_PATH="$PWD"
if git rev-parse --is-inside-work-tree &>/dev/null 2>&1; then
  BRANCH="$(git branch --show-current 2>/dev/null || true)"
  PROJECT_PATH="$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")"
fi

PAYLOAD="$(echo "$INPUT" | jq -c \\
  --arg mid "$MACHINE_ID" \\
  --argjson ts "$TIMESTAMP" \\
  --arg pp "$PROJECT_PATH" \\
  --arg br "$BRANCH" \\
  '{${jqFields.join(", ")}, timestamp: $ts}' \\
  | jq -c 'with_entries(select(.value != null))'
)"

curl -sf -X POST "$API_URL/events" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $API_KEY" \\
  -d "$PAYLOAD" \\
  --max-time 2 >/dev/null 2>&1 || true

exit 0`;
  });

  const settingsJson = createMemo(() => {
    const hook = { type: "command", command: "bash ~/.claudemon-hook.sh", async: true };
    const entry = [{ matcher: "", hooks: [hook] }];
    return JSON.stringify({
      hooks: {
        PreToolUse: entry,
        PostToolUse: entry,
        Notification: entry,
        Stop: entry,
      }
    }, null, 2);
  });

  const ready = () => !!apiKey();

  return (
    <div class="flex-1 overflow-y-auto smooth-scroll">
      <div class="w-full max-w-[1100px] mx-auto px-6 py-10 flex gap-10">

        {/* ── LEFT COLUMN: Trust + Auth ─────────────────────── */}
        <div class="w-[380px] shrink-0">
          {/* Hero */}
          <div class="flex items-center gap-3 mb-6">
            <div class="w-9 h-9 rounded-full bg-safe/10 border border-safe/20 flex items-center justify-center">
              <ShieldCheck size={18} class="text-safe" />
            </div>
            <div>
              <h1 class="text-base font-bold tracking-wide">ClaudeMon</h1>
              <p class="text-[13px] text-text-dim">Real-time session monitor</p>
            </div>
          </div>

          {/* Feature pills */}
          <div class="flex gap-4 mb-6 text-[12px]">
            <span class="flex items-center gap-1.5 text-text-sub"><TreeStructure size={12} class="text-safe" /> Agent Map</span>
            <span class="flex items-center gap-1.5 text-text-sub"><Eye size={12} class="text-suspicious" /> Live Activity</span>
            <span class="flex items-center gap-1.5 text-text-sub"><Lightning size={12} class="text-attack" /> Conflicts</span>
          </div>

          {/* Data toggles */}
          <div class="mb-5">
            <h2 class="text-[13px] font-bold uppercase tracking-wider text-text-label mb-3">Choose what to send</h2>
            <p class="text-[13px] text-text-dim mb-3">
              Toggle each field on or off. The hook script on the right updates live.
            </p>

            <div class="space-y-1">
              <For each={FIELDS}>
                {(field) => {
                  const on = () => enabledFields()[field.id];
                  return (
                    <button
                      onClick={() => toggleField(field.id)}
                      class={`w-full flex items-center gap-3 px-3 py-1.5 rounded text-left transition-colors ${
                        field.required ? "cursor-default" : "cursor-pointer hover:bg-card/80"
                      }`}
                    >
                      <div class={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        on() ? "bg-safe/20 border-safe/50" : "border-panel-border/60"
                      }`}>
                        <Show when={on()}>
                          <Check size={10} class="text-safe" />
                        </Show>
                      </div>
                      <span class={`text-[13px] font-mono ${on() ? "text-text-primary" : "text-text-sub line-through"}`}>
                        {field.label}
                      </span>
                      <span class="text-[12px] text-text-sub ml-auto">{field.desc}</span>
                      <Show when={field.required}>
                        <span class="text-[9px] text-text-sub uppercase tracking-wider">required</span>
                      </Show>
                    </button>
                  );
                }}
              </For>
            </div>
          </div>

          {/* Never sent */}
          <p class="text-[13px] text-text-dim mb-4">
            <span class="text-attack font-bold">Never sent:</span>{" "}
            file contents, API keys, env vars, your conversation.
          </p>

          {/* Privacy badges */}
          <div class="flex flex-wrap gap-x-4 gap-y-1.5 text-[12px] text-text-dim mb-6">
            <span class="flex items-center gap-1.5"><ShieldCheck size={12} class="text-safe" /> Ephemeral (1hr purge)</span>
            <span class="flex items-center gap-1.5"><ShieldCheck size={12} class="text-safe" /> Open source</span>
            <span class="flex items-center gap-1.5"><ShieldCheck size={12} class="text-safe" /> Self-hostable</span>
          </div>

          {/* Divider */}
          <div class="border-t border-panel-border/30 my-6" />

          {/* Auth + API key */}
          <div>
            <h2 class="text-[13px] font-bold uppercase tracking-wider text-text-label mb-3">
              {props.user ? "API Key" : "Sign in"}
            </h2>

            <Show when={!props.authLoading}>
              <Show when={props.user} fallback={
                <div>
                  <p class="text-[13px] text-text-dim mb-3">Sign in to get an API key. Events without one are rejected.</p>
                  <a
                    href={`${props.apiUrl}/auth/login?redirect=${encodeURIComponent(window.location.href)}`}
                    class="inline-flex items-center gap-2 bg-[#161b22] border border-[#30363d] rounded px-5 py-2.5 text-[13px] text-white hover:bg-[#1c2128] transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
                    Sign in with GitHub
                  </a>
                </div>
              }>
                {(u) => (
                  <div>
                    <div class="flex items-center gap-2.5 mb-3 text-[13px]">
                      <img src={u().avatar_url} alt={u().login} class="w-6 h-6 rounded-full border border-panel-border" />
                      <span class="text-text-label">{u().login}</span>
                      <Check size={13} class="text-safe" />
                    </div>
                    <Show when={!apiKey()} fallback={
                      <div class="flex items-center gap-2 bg-[#0e0d0c] border border-panel-border/50 rounded px-3 py-2">
                        <code class="text-[13px] text-safe flex-1 truncate">{apiKey()}</code>
                        <CopyBtn text={apiKey()!} />
                      </div>
                    }>
                      <button
                        onClick={createApiKey}
                        disabled={apiKeyLoading()}
                        class="flex items-center gap-2 bg-safe/15 border border-safe/30 rounded px-5 py-2.5 text-[13px] font-bold text-safe hover:bg-safe/25 transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {apiKeyLoading() ? "Creating..." : "Create API key"}
                      </button>
                    </Show>
                  </div>
                )}
              </Show>
            </Show>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Generated script + Install ──────── */}
        <div class="flex-1 min-w-0">
          <div class="sticky top-10 space-y-6">
            {/* Hook script — always visible, updates live */}
            <div>
              <h2 class="text-[13px] font-bold uppercase tracking-wider text-text-label mb-2">
                Your hook script
                <span class="text-[11px] text-text-sub font-normal ml-2">updates as you toggle fields</span>
              </h2>
              <CodeBlock code={hookScript()} lang="bash" />
              <p class="text-[11px] text-text-sub mt-2">
                Save as <code class="text-[12px] text-text-dim bg-card px-1.5 py-0.5 rounded">~/.claudemon-hook.sh</code> and
                run <code class="text-[12px] text-text-dim bg-card px-1.5 py-0.5 rounded">chmod +x ~/.claudemon-hook.sh</code>
              </p>
            </div>

            {/* Settings JSON */}
            <div>
              <h2 class="text-[13px] font-bold uppercase tracking-wider text-text-label mb-2">Add to ~/.claude/settings.json</h2>
              <CodeBlock code={settingsJson()} lang="json" />
            </div>

            {/* Verify */}
            <div class="border-t border-panel-border/30 pt-5">
              <div class="flex items-center gap-2.5 text-[13px]">
                <span class="w-2.5 h-2.5 rounded-full bg-safe animate-pulse" />
                <span class="text-text-dim">Listening for sessions via WebSocket...</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
