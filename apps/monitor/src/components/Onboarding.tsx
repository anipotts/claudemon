import { type Component, createSignal, Show, For, createMemo, onMount, onCleanup } from "solid-js";
import { ShieldCheck, Copy, Check, CaretDown, CaretRight } from "./Icons";
import { HOOK_EVENTS } from "../../../../packages/types/monitor";

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
      {copied() ? (
        <Check size={13} class="text-safe" />
      ) : (
        <Copy size={13} class="text-text-sub hover:text-text-primary" />
      )}
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
      <div
        class={`relative bg-[#0e0d0c] border border-panel-border/50 rounded flex-1 min-h-0 overflow-auto ${props.maxH || ""}`}
      >
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
      while (j < s.length && s[j] !== '"') {
        if (s[j] === "\\") j++;
        j++;
      }
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
    } else if (s.slice(i).match(/^-?\d+/)) {
      const m = s.slice(i).match(/^-?\d+/)!;
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
  category: string;
  privacy?: boolean;
}

const FIELD_CATEGORIES = [
  "Identity",
  "Event",
  "Tool",
  "Session",
  "Agent",
  "Stop/Error",
  "Notification",
  "Compact",
  "Permission",
  "User Prompt",
] as const;

const FIELDS: FieldConfig[] = [
  // Identity
  {
    id: "session_id",
    label: "session_id",
    required: true,
    default: true,
    jqField: "session_id: .session_id",
    category: "Identity",
  },
  {
    id: "machine_id",
    label: "machine_id",
    required: true,
    default: true,
    jqField: "machine_id: $mid",
    category: "Identity",
  },
  { id: "project_path", label: "project_path", default: true, jqField: "project_path: $pp", category: "Identity" },
  { id: "branch", label: "branch", default: true, jqField: "branch: $br", category: "Identity" },

  // Event
  {
    id: "hook_event_name",
    label: "hook_event_name",
    required: true,
    default: true,
    jqField: "hook_event_name: .hook_event_name",
    category: "Event",
  },

  // Tool
  { id: "tool_name", label: "tool_name", default: true, jqField: "tool_name: .tool_name", category: "Tool" },
  { id: "tool_input", label: "tool_input", default: true, jqField: "tool_input: .tool_input", category: "Tool" },
  {
    id: "tool_response",
    label: "tool_response",
    default: false,
    jqField: "tool_response: (.tool_response // null)",
    category: "Tool",
  },
  {
    id: "tool_use_id",
    label: "tool_use_id",
    default: true,
    jqField: "tool_use_id: (.tool_use_id // null)",
    category: "Tool",
  },

  // Session
  { id: "model", label: "model", default: true, jqField: "model: (.model // null)", category: "Session" },
  { id: "source", label: "source", default: true, jqField: "source: (.source // null)", category: "Session" },
  {
    id: "permission_mode",
    label: "permission_mode",
    default: true,
    jqField: "permission_mode: (.permission_mode // null)",
    category: "Session",
  },
  { id: "cwd", label: "cwd", default: true, jqField: "cwd: (.cwd // null)", category: "Session" },
  {
    id: "transcript_path",
    label: "transcript_path",
    default: false,
    jqField: "transcript_path: (.transcript_path // null)",
    category: "Session",
  },

  // Agent
  { id: "agent_id", label: "agent_id", default: true, jqField: "agent_id: (.agent_id // null)", category: "Agent" },
  {
    id: "agent_type",
    label: "agent_type",
    default: true,
    jqField: "agent_type: (.agent_type // null)",
    category: "Agent",
  },

  // Stop/Error
  {
    id: "last_assistant_message",
    label: "last_assistant_message",
    default: false,
    jqField: "last_assistant_message: (.last_assistant_message // null)",
    category: "Stop/Error",
    privacy: true,
  },
  { id: "error", label: "error", default: true, jqField: "error: (.error // null)", category: "Stop/Error" },
  {
    id: "is_interrupt",
    label: "is_interrupt",
    default: true,
    jqField: "is_interrupt: (.is_interrupt // null)",
    category: "Stop/Error",
  },

  // Notification
  {
    id: "notification_message",
    label: "notification_message",
    default: true,
    jqField: "notification_message: (.message // null)",
    category: "Notification",
  },
  {
    id: "notification_title",
    label: "notification_title",
    default: true,
    jqField: "notification_title: (.title // null)",
    category: "Notification",
  },
  {
    id: "notification_type",
    label: "notification_type",
    default: true,
    jqField: "notification_type: (.notification_type // null)",
    category: "Notification",
  },

  // Compact
  {
    id: "compact_trigger",
    label: "compact_trigger",
    default: true,
    jqField: "compact_trigger: (.trigger // null)",
    category: "Compact",
  },
  {
    id: "compact_summary",
    label: "compact_summary",
    default: false,
    jqField: "compact_summary: (.compact_summary // null)",
    category: "Compact",
  },

  // Permission
  {
    id: "permission_denied_reason",
    label: "permission_denied_reason",
    default: true,
    jqField: "permission_denied_reason: (.reason // null)",
    category: "Permission",
  },

  // User Prompt
  {
    id: "prompt",
    label: "prompt",
    default: false,
    jqField: "prompt: (.prompt // null)",
    category: "User Prompt",
    privacy: true,
  },
];

// ── Main ────────────────────────────────────────────────────────────

interface User {
  sub: string;
  name: string;
  login: string;
  avatar_url: string;
}

export const Onboarding: Component<{
  apiUrl: string;
  user: User | null;
  authLoading: boolean;
  onSetupComplete?: () => void;
  onClose?: () => void;
}> = (props) => {
  const [apiKey, _setApiKey] = createSignal<string | null>(
    typeof localStorage !== "undefined" ? localStorage.getItem("claudemon_api_key") : null,
  );
  const setApiKey = (key: string | null) => {
    if (key) localStorage.setItem("claudemon_api_key", key);
    else localStorage.removeItem("claudemon_api_key");
    _setApiKey(key);
  };
  const [apiKeyLoading, setApiKeyLoading] = createSignal(false);
  const [hookType, setHookType] = createSignal<"http" | "bash" | "npm">("npm");
  const [enabledFields, setEnabledFields] = createSignal<Record<string, boolean>>(
    Object.fromEntries(FIELDS.map((f) => [f.id, f.default])),
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
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: "onboarding" }),
      });
      const data = await res.json();
      if (data.key) {
        setApiKey(data.key);
        props.onSetupComplete?.();
      }
    } catch (e) {
      console.error("Failed to create API key:", e);
    } finally {
      setApiKeyLoading(false);
    }
  };

  const groupedFields = createMemo(() => {
    const groups: Array<{ category: string; fields: FieldConfig[] }> = [];
    for (const cat of FIELD_CATEGORIES) {
      const catFields = FIELDS.filter((f) => f.category === cat);
      if (catFields.length > 0) groups.push({ category: cat, fields: catFields });
    }
    return groups;
  });

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

  const installCommand = createMemo(() => {
    const key = apiKey() || "YOUR_API_KEY";
    const events = HOOK_EVENTS.join("','");
    return `python3 -c "
import json,os,re,pathlib
d=os.path.expanduser('~/.claude')
pathlib.Path(d).mkdir(exist_ok=True)
p=os.path.join(d,'settings.json')
s=json.load(open(p)) if os.path.exists(p) else {}
h={'type':'http','url':'https://api.claudemon.com/events','headers':{'Authorization':'Bearer \\$CLAUDEMON_API_KEY'},'allowedEnvVars':['CLAUDEMON_API_KEY'],'timeout':3}
cm={'matcher':'','hooks':[h]}
s.setdefault('hooks',{})
for e in ['${events}']:
 grps=s['hooks'].get(e,[])
 grps=[g for g in grps if not any('claudemon' in (hk.get('url','') + hk.get('command','')) for hk in g.get('hooks',[]))]
 grps.append(cm)
 s['hooks'][e]=grps
open(p,'w').write(json.dumps(s,indent=2))
seen=set(json.dumps(g) for e in s['hooks'] for g in s['hooks'][e] if not any('claudemon' in (hk.get('url','')+hk.get('command','')) for hk in g.get('hooks',[])))
print('Added ClaudeMon hooks to',p,'(preserved',len(seen),'existing hook groups)')
# Set env var (detect shell)
sh=os.environ.get('SHELL','')
rc=os.path.expanduser('~/.zshrc') if 'zsh' in sh else os.path.expanduser('~/.bashrc')
for f in ['~/.config/fish/config.fish','~/.bash_profile']:
 if os.path.exists(os.path.expanduser(f)) and ('fish' in sh if 'fish' in f else 'bash' in sh): rc=os.path.expanduser(f); break
line=\"export CLAUDEMON_API_KEY='${key}'\"
if os.path.exists(rc):
 txt=open(rc).read()
 if 'CLAUDEMON_API_KEY=' in txt:
  txt=re.sub(r'^.*CLAUDEMON_API_KEY=.*$',line,txt,flags=re.MULTILINE)
 else: txt=txt.rstrip()+'\\n'+line+'\\n'
 open(rc,'w').write(txt)
else: open(rc,'w').write(line+'\\n')
print('Set CLAUDEMON_API_KEY in',rc)
print('Done! Restart your terminal.')
"`;
  });

  const settingsJson = createMemo(() => {
    const hook =
      hookType() === "http"
        ? {
            type: "http",
            url: "https://api.claudemon.com/events",
            headers: { Authorization: "Bearer $CLAUDEMON_API_KEY" },
            allowedEnvVars: ["CLAUDEMON_API_KEY"],
            timeout: 3,
          }
        : { type: "command", command: "bash ~/.claudemon-hook.sh", async: true };
    const entry = [{ matcher: "", hooks: [hook] }];
    const hooks = Object.fromEntries(HOOK_EVENTS.map((evt) => [evt, entry]));
    return JSON.stringify({ hooks }, null, 2);
  });

  const npmInstallCmd = "npm install -g claudemon-cli";
  const npmInitCmd = createMemo(() => {
    const key = apiKey() || "YOUR_API_KEY";
    return `claudemon-cli init --key ${key}`;
  });

  const ready = () => !!apiKey();

  const [isMobile, setIsMobile] = createSignal(
    typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches,
  );
  const [fieldsOpen, setFieldsOpen] = createSignal(false);

  onMount(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    onCleanup(() => mq.removeEventListener("change", handler));
  });

  return (
    <div class="flex-1 flex flex-col overflow-hidden">
      {/* Back button when opened from idle dashboard */}
      <Show when={props.onClose}>
        <div class="shrink-0 border-b border-panel-border/30 px-4 py-2 flex items-center gap-2">
          <button
            onClick={() => props.onClose!()}
            class="text-[10px] text-text-sub hover:text-text-primary transition-colors flex items-center gap-1.5"
          >
            <CaretRight size={10} style={{ transform: "rotate(180deg)" }} />
            Back to dashboard
          </button>
        </div>
      </Show>
      {/* 3-column grid fills viewport below header — stacks on mobile */}
      <div class={`flex-1 flex min-h-0 onboarding-grid ${isMobile() ? "flex-col overflow-y-auto" : ""}`}>
        {/* ── COL 1: Auth + API key ──────────────────────────── */}
        <div class="flex-1 border-r border-panel-border/30 p-5 flex flex-col overflow-y-auto">
          <div class="flex items-baseline gap-2 mb-4">
            <span class="text-[13px] font-bold text-text-label">1</span>
            <h2 class="text-[13px] font-bold uppercase tracking-wider text-text-label">Get API key</h2>
          </div>

          <Show when={!props.authLoading}>
            <Show
              when={props.user}
              fallback={
                <div>
                  <a
                    href={`${props.apiUrl}/auth/login?redirect=${encodeURIComponent(window.location.href)}`}
                    class="inline-flex items-center gap-2 bg-[#161b22] border border-[#30363d] rounded px-4 py-2 text-[13px] text-white hover:bg-[#1c2128] transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                    </svg>
                    Sign in with GitHub
                  </a>
                </div>
              }
            >
              {(u) => {
                // This whole block re-runs once when user becomes truthy.
                // Inner JSX expressions ARE reactive in SolidJS.
                return (
                  <div>
                    <div class="flex items-center gap-2 mb-4 text-[13px]">
                      <img
                        src={u().avatar_url}
                        alt={u().login}
                        class="w-5 h-5 rounded-full border border-panel-border"
                      />
                      <span class="text-text-label">{u().login}</span>
                      <Check size={12} class="text-safe" />
                    </div>
                    <div class="mb-4">
                      <Show when={apiKey()}>
                        {(key) => (
                          <div class="flex items-center gap-2 bg-[#0e0d0c] border border-safe/30 rounded px-3 py-2">
                            <code class="text-[12px] text-safe flex-1 truncate font-mono">{key()}</code>
                            <CopyBtn text={key()} />
                          </div>
                        )}
                      </Show>
                      <Show when={!apiKey()}>
                        <button
                          onClick={createApiKey}
                          disabled={apiKeyLoading()}
                          class="flex items-center gap-2 bg-safe/15 border border-safe/30 rounded px-4 py-2 text-[13px] font-bold text-safe hover:bg-safe/25 transition-colors disabled:opacity-50 cursor-pointer"
                        >
                          {apiKeyLoading() ? "Creating..." : "Create API key"}
                        </button>
                      </Show>
                    </div>
                  </div>
                );
              }}
            </Show>
          </Show>

          <div class="border-t border-panel-border/30 my-4" />

          <div class="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-dim mb-3">
            <span class="flex items-center gap-1">
              <ShieldCheck size={10} class="text-safe" /> Ephemeral
            </span>
            <span class="flex items-center gap-1">
              <ShieldCheck size={10} class="text-safe" /> Open source
            </span>
            <span class="flex items-center gap-1">
              <ShieldCheck size={10} class="text-safe" /> Self-hostable
            </span>
          </div>
          <p class="text-[12px] text-text-dim">
            <span class="text-attack font-bold">Never sent:</span> file contents, API keys, env vars, your conversation.
          </p>
        </div>

        {/* ── COL 2: Choose fields ───────────────────────────── */}
        <div
          class={`flex-1 border-r border-panel-border/30 p-5 flex flex-col overflow-y-auto transition-opacity ${ready() ? "" : "opacity-25 pointer-events-none"}`}
        >
          <div class="flex items-baseline gap-2 mb-4">
            <span class="text-[13px] font-bold text-text-label">2</span>
            <h2 class="text-[13px] font-bold uppercase tracking-wider text-text-label">Choose fields</h2>
            <Show when={isMobile()}>
              <button
                onClick={() => setFieldsOpen(!fieldsOpen())}
                class="ml-auto text-text-sub hover:text-text-primary transition-colors"
              >
                {fieldsOpen() ? <CaretDown size={12} /> : <CaretRight size={12} />}
              </button>
            </Show>
          </div>

          <div
            class={isMobile() ? `fields-collapsible-body ${fieldsOpen() ? "fields-expanded" : "fields-collapsed"}` : ""}
          >
            <Show when={hookType() !== "bash"}>
              <div class="bg-safe/8 border border-safe/20 rounded px-3 py-2 mb-4">
                <p class="text-[11px] text-safe">HTTP hooks send all fields automatically. No script needed.</p>
              </div>
            </Show>

            <div class={`space-y-3 mb-4 ${hookType() !== "bash" ? "opacity-30 pointer-events-none" : ""}`}>
              <For each={groupedFields()}>
                {(group) => (
                  <div>
                    <div class="text-[9px] text-text-dim uppercase tracking-widest font-bold mb-1 px-2.5">
                      {group.category}
                    </div>
                    <div class="space-y-0">
                      <For each={group.fields}>
                        {(field) => {
                          const on = () => enabledFields()[field.id];
                          return (
                            <button
                              onClick={() => toggleField(field.id)}
                              class={`w-full flex items-center gap-2.5 px-2.5 py-1 rounded text-left transition-colors ${
                                field.required ? "cursor-default" : "cursor-pointer hover:bg-card/80"
                              }`}
                            >
                              <div
                                class={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                                  on() ? "bg-safe/20 border-safe/50" : "border-panel-border/60"
                                }`}
                              >
                                <Show when={on()}>
                                  <Check size={9} class="text-safe" />
                                </Show>
                              </div>
                              <span
                                class={`text-[12px] font-mono ${on() ? "text-text-primary" : "text-text-sub line-through"}`}
                              >
                                {field.label}
                              </span>
                              <Show when={field.required}>
                                <span class="text-[9px] text-text-sub uppercase tracking-wider ml-auto">req</span>
                              </Show>
                              <Show when={field.privacy}>
                                <span class="text-[9px] bg-attack/20 text-attack border border-attack/30 rounded px-1.5 py-0.5 ml-auto uppercase tracking-wider">
                                  Contains your messages
                                </span>
                              </Show>
                            </button>
                          );
                        }}
                      </For>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </div>
          {/* end fields-collapsible-body wrapper */}
        </div>

        {/* ── COL 3: Install (hook + settings) ───────────────── */}
        <div
          class={`flex-1 p-5 flex flex-col transition-opacity ${isMobile() ? "overflow-visible" : "overflow-hidden"} ${ready() ? "" : "opacity-25 pointer-events-none"}`}
        >
          <div class="flex items-baseline gap-2 mb-3">
            <span class="text-[13px] font-bold text-text-label">3</span>
            <h2 class="text-[13px] font-bold uppercase tracking-wider text-text-label">Install</h2>
          </div>

          {/* Hook type toggle */}
          <div class="flex items-center gap-1 mb-4 bg-[#0e0d0c] border border-panel-border/50 rounded p-0.5 w-fit">
            <button
              onClick={() => setHookType("npm")}
              class={`px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-colors ${
                hookType() === "npm" ? "bg-[#cb3837]/20 text-[#cb3837]" : "text-text-sub hover:text-text-primary"
              }`}
            >
              npm
            </button>
            <button
              onClick={() => setHookType("http")}
              class={`px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-colors ${
                hookType() === "http" ? "bg-safe/20 text-safe" : "text-text-sub hover:text-text-primary"
              }`}
            >
              HTTP
            </button>
            <button
              onClick={() => setHookType("bash")}
              class={`px-3 py-1 rounded text-[11px] font-bold uppercase tracking-wider transition-colors ${
                hookType() === "bash" ? "bg-suspicious/20 text-suspicious" : "text-text-sub hover:text-text-primary"
              }`}
            >
              Bash
            </button>
          </div>

          <Show when={hookType() === "npm"}>
            <div class="text-[10px] text-[#cb3837] mb-3 flex items-center gap-1.5">
              <ShieldCheck size={10} />
              Recommended — two commands, zero config
            </div>

            <div class="mb-4">
              <div class="text-[10px] text-text-sub uppercase tracking-wider mb-1.5">Step 1 — Install</div>
              <div class="group relative bg-[#0e0d0c] border border-panel-border/50 rounded px-3 py-2.5">
                <pre class="text-[11.5px] leading-[1.6] font-mono text-text-primary">{npmInstallCmd}</pre>
                <div class="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <CopyBtn text={npmInstallCmd} />
                </div>
              </div>
            </div>

            <div class="mb-4">
              <div class="text-[10px] text-text-sub uppercase tracking-wider mb-1.5">Step 2 — Connect</div>
              <div class="group relative bg-[#0e0d0c] border border-[#cb3837]/30 rounded px-3 py-2.5">
                <pre class="text-[11.5px] leading-[1.6] font-mono text-[#cb3837]">{npmInitCmd()}</pre>
                <div class="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <CopyBtn text={npmInitCmd()} />
                </div>
              </div>
              <div class="text-[9px] text-text-dim mt-1.5">
                Adds hooks to ~/.claude/settings.json and saves your key. Preserves existing hooks.
              </div>
            </div>

            <div class="space-y-1.5 text-[11px] text-text-dim font-mono">
              <div class="flex items-start gap-2">
                <span class="text-safe shrink-0">1.</span> Registers all 27 Claude Code hook events
              </div>
              <div class="flex items-start gap-2">
                <span class="text-safe shrink-0">2.</span> Saves API key to your shell profile
              </div>
              <div class="flex items-start gap-2">
                <span class="text-safe shrink-0">3.</span> Idempotent — safe to run again
              </div>
            </div>
          </Show>

          <Show when={hookType() === "http"}>
            <div class="text-[10px] text-safe mb-3 flex items-center gap-1.5">
              <ShieldCheck size={10} />
              Manual — native Claude Code HTTP hooks, no script needed
            </div>

            {/* One-click install command */}
            <div class="mb-4">
              <div class="text-[10px] text-text-sub uppercase tracking-wider mb-1.5">
                Option A — paste into your terminal
              </div>
              <div class="group relative bg-[#0e0d0c] border border-safe/30 rounded px-3 py-2.5">
                <pre class="text-[11px] leading-[1.5] font-mono text-safe whitespace-pre-wrap break-all">
                  {installCommand()}
                </pre>
                <div class="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <CopyBtn text={installCommand()} />
                </div>
              </div>
              <div class="text-[9px] text-text-dim mt-1.5">
                Merges hooks into your existing settings.json — won't overwrite anything.
              </div>
            </div>

            <div class="text-[10px] text-text-sub uppercase tracking-wider mb-1.5">Option B — full JSON</div>
          </Show>
          <Show when={hookType() === "bash"}>
            <div class="text-[10px] text-suspicious mb-3">Fallback — requires bash, jq, and curl on your system</div>
          </Show>

          <Show when={hookType() !== "npm"}>
            <div class="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto">
              <Show when={hookType() === "bash"}>
                <CodeBlock code={hookScript()} label="Save as ~/.claudemon-hook.sh" lang="bash" />
              </Show>
              <CodeBlock
                code={settingsJson()}
                label={hookType() === "http" ? "" : "Add to ~/.claude/settings.json"}
                lang="json"
              />
            </div>
          </Show>

          <div class="mt-3 flex items-center gap-2.5 text-[12px]">
            <span class="w-2 h-2 rounded-full bg-safe animate-pulse" />
            <span class="text-text-dim">Listening for sessions...</span>
          </div>
        </div>
      </div>
    </div>
  );
};
