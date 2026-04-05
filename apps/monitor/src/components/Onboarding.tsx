import { type Component, createSignal, Show, For } from "solid-js";
import {
  ShieldCheck,
  Copy,
  Check,
  ArrowRight,
  Eye,
  EyeSlash,
  Lightning,
  TreeStructure,
} from "./Icons";

const API_URL = import.meta.env.VITE_MONITOR_API_URL || "https://api.claudemon.com";

// ── Copy button ─────────────────────────────────────────────────────

function CopyBlock(props: { text: string; label?: string; mono?: boolean }) {
  const [copied, setCopied] = createSignal(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(props.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class="group relative">
      <Show when={props.label}>
        <div class="text-[9px] text-text-sub uppercase tracking-wider mb-1.5">{props.label}</div>
      </Show>
      <button
        onClick={handleCopy}
        class="w-full text-left bg-[#0e0d0c] border border-panel-border/60 rounded px-3 py-2.5 text-[12px] text-text-primary leading-5 hover:border-text-dim/40 transition-all cursor-pointer"
      >
        <pre class={`whitespace-pre-wrap break-all overflow-hidden ${props.mono !== false ? "font-mono" : ""}`}>{props.text}</pre>
        <span class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {copied() ? (
            <Check size={14} class="text-safe" />
          ) : (
            <Copy size={14} class="text-text-sub" />
          )}
        </span>
      </button>
    </div>
  );
}

// ── Data field visualization ────────────────────────────────────────

function DataField(props: { name: string; example: string; why: string }) {
  return (
    <div class="flex items-start gap-3 py-1.5">
      <span class="text-safe text-[10px] mt-0.5">
        <Check size={10} />
      </span>
      <div class="flex-1 min-w-0">
        <div class="flex items-baseline gap-2">
          <span class="text-[11px] text-text-primary font-bold">{props.name}</span>
          <span class="text-[10px] text-text-sub truncate">{props.example}</span>
        </div>
        <div class="text-[10px] text-text-dim">{props.why}</div>
      </div>
    </div>
  );
}

function BlockedField(props: { name: string }) {
  return (
    <div class="flex items-center gap-3 py-1">
      <span class="text-attack text-[10px]">
        <EyeSlash size={10} />
      </span>
      <span class="text-[11px] text-text-sub line-through">{props.name}</span>
    </div>
  );
}

// ── Section divider ─────────────────────────────────────────────────

function Divider() {
  return <div class="border-t border-panel-border/30 my-8" />;
}

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
  const [showHookSource, setShowHookSource] = createSignal(false);
  const [hookSource, setHookSource] = createSignal<string | null>(null);

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

  const loadHookSource = async () => {
    if (hookSource()) {
      setShowHookSource(!showHookSource());
      return;
    }
    try {
      const res = await fetch(`${props.apiUrl}/hook.sh`);
      setHookSource(await res.text());
      setShowHookSource(true);
    } catch {
      setShowHookSource(false);
    }
  };

  const installCmd = () => {
    const key = apiKey();
    const base = `curl -fsSL ${props.apiUrl}/hook.sh -o ~/.claudemon-hook.sh && chmod +x ~/.claudemon-hook.sh`;
    if (key) {
      return `${base}\n\n# Add your API key to your shell profile (~/.zshrc or ~/.bashrc)\nexport CLAUDEMON_API_KEY="${key}"`;
    }
    return base;
  };

  const settingsSnippet = () => `{
  "hooks": {
    "PreToolUse": [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash ~/.claudemon-hook.sh", "async": true }] }],
    "PostToolUse": [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash ~/.claudemon-hook.sh", "async": true }] }],
    "Notification": [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash ~/.claudemon-hook.sh", "async": true }] }],
    "Stop": [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash ~/.claudemon-hook.sh", "async": true }] }]
  }
}`;

  return (
    <div class="flex-1 overflow-y-auto smooth-scroll">
      <div class="max-w-lg mx-auto px-6 py-16 space-y-0">

        {/* ── Hero ──────────────────────────────────────────────── */}
        <div class="text-center mb-4">
          <div class="inline-flex items-center justify-center w-14 h-14 rounded-full bg-safe/10 border border-safe/20 mb-5">
            <ShieldCheck size={28} class="text-safe" />
          </div>
          <h1 class="text-2xl font-bold tracking-wide mb-2">ClaudeMon</h1>
          <p class="text-[13px] text-text-dim leading-5">
            See every Claude Code session across machines, branches, and worktrees — in real time.
          </p>
        </div>

        {/* ── Value props (compact) ─────────────────────────────── */}
        <div class="flex justify-center gap-8 text-center py-4">
          <div class="flex flex-col items-center gap-1">
            <TreeStructure size={16} class="text-safe" />
            <span class="text-[10px] text-text-label">Agent Map</span>
          </div>
          <div class="flex flex-col items-center gap-1">
            <Eye size={16} class="text-suspicious" />
            <span class="text-[10px] text-text-label">Live Activity</span>
          </div>
          <div class="flex flex-col items-center gap-1">
            <Lightning size={16} class="text-attack" />
            <span class="text-[10px] text-text-label">Conflicts</span>
          </div>
        </div>

        <Divider />

        {/* ── What data is sent ─────────────────────────────────── */}
        <div>
          <h2 class="text-sm font-bold mb-1">Exactly what the hook sends</h2>
          <p class="text-[11px] text-text-dim mb-4">
            The hook is a short bash script that runs on each Claude Code tool call.
            Here is every field it transmits — nothing else.
          </p>

          <div class="bg-card/30 border border-panel-border/40 rounded p-4 mb-3">
            <div class="text-[9px] text-text-sub uppercase tracking-wider mb-2">Sent</div>
            <DataField name="session_id" example="e.g. a1b2c3d4" why="Which session this event belongs to" />
            <DataField name="machine_id" example="e.g. macbook-pro" why="Your hostname, so you can see which machine" />
            <DataField name="project_path" example="e.g. ~/Code/my-app" why="Which project directory" />
            <DataField name="branch" example="e.g. main" why="Current git branch" />
            <DataField name="hook_event_name" example="e.g. PostToolUse" why="What type of event (tool call, stop, etc.)" />
            <DataField name="tool_name" example="e.g. Edit, Bash, Read" why="Which tool Claude used" />
            <DataField name="tool_input" example="e.g. file_path, command" why="Tool arguments (file paths, commands)" />
            <DataField name="tool_response" example="e.g. diff output" why="What the tool returned" />
            <DataField name="model" example="e.g. opus-4" why="Which model is running" />
          </div>

          <div class="bg-card/30 border border-panel-border/40 rounded p-4 mb-4">
            <div class="text-[9px] text-text-sub uppercase tracking-wider mb-2">Never sent</div>
            <BlockedField name="File contents (only paths and diffs)" />
            <BlockedField name="API keys, tokens, or secrets" />
            <BlockedField name="Environment variables" />
            <BlockedField name="Your conversation with Claude" />
            <BlockedField name="Anything outside the tool call" />
          </div>

          <div class="flex flex-col gap-2 text-[11px] text-text-dim">
            <div class="flex items-start gap-2">
              <ShieldCheck size={12} class="text-safe shrink-0 mt-0.5" />
              <span><strong class="text-text-label">Ephemeral.</strong> No database. Events live in memory and auto-purge after 1 hour of inactivity.</span>
            </div>
            <div class="flex items-start gap-2">
              <ShieldCheck size={12} class="text-safe shrink-0 mt-0.5" />
              <span><strong class="text-text-label">Open source.</strong> Every line — the hook, the relay, the dashboard — is on GitHub.</span>
            </div>
            <div class="flex items-start gap-2">
              <ShieldCheck size={12} class="text-safe shrink-0 mt-0.5" />
              <span><strong class="text-text-label">Self-hostable.</strong> Run your own instance on Cloudflare Workers free tier. Zero cost.</span>
            </div>
          </div>

          <button
            onClick={loadHookSource}
            class="mt-4 text-[11px] text-text-sub hover:text-text-primary transition-colors cursor-pointer"
          >
            {showHookSource() ? "Hide hook source code" : "View the full hook source code"}
          </button>

          <Show when={showHookSource() && hookSource()}>
            <div class="mt-2 bg-[#0e0d0c] border border-panel-border/40 rounded p-3 max-h-[300px] overflow-y-auto smooth-scroll">
              <pre class="text-[10px] text-text-dim leading-4 whitespace-pre-wrap break-all">{hookSource()}</pre>
            </div>
          </Show>
        </div>

        <Divider />

        {/* ── Sign in + API key ─────────────────────────────────── */}
        <div>
          <h2 class="text-sm font-bold mb-1">Get your API key</h2>
          <p class="text-[11px] text-text-dim mb-4">
            Sign in with GitHub to create an API key. The hook uses this key to authenticate
            events to your private dashboard — without it, events are rejected.
          </p>

          <Show when={!props.authLoading}>
            <Show when={props.user} fallback={
              <a
                href={`${props.apiUrl}/auth/login?redirect=${encodeURIComponent(window.location.href)}`}
                class="inline-flex items-center gap-2 bg-[#161b22] border border-[#30363d] rounded px-5 py-2.5 text-[12px] text-white hover:bg-[#1c2128] transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
                Sign in with GitHub
              </a>
            }>
              {(u) => (
                <div class="space-y-3">
                  <div class="flex items-center gap-3 text-[12px]">
                    <img
                      src={u().avatar_url}
                      alt={u().login}
                      class="w-6 h-6 rounded-full border border-panel-border"
                    />
                    <span class="text-text-label">{u().name || u().login}</span>
                    <Check size={12} class="text-safe" />
                  </div>

                  <Show when={!apiKey()} fallback={
                    <div class="space-y-2">
                      <div class="text-[10px] text-safe uppercase tracking-wider font-bold">Your API key (copy it now — shown only once)</div>
                      <CopyBlock text={apiKey()!} />
                    </div>
                  }>
                    <button
                      onClick={createApiKey}
                      disabled={apiKeyLoading()}
                      class="flex items-center gap-2 bg-safe/15 border border-safe/30 rounded px-4 py-2 text-[11px] font-bold text-safe hover:bg-safe/25 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {apiKeyLoading() ? "Creating..." : "Create API key"}
                    </button>
                  </Show>
                </div>
              )}
            </Show>
          </Show>

          <Show when={props.authLoading}>
            <div class="text-[11px] text-text-sub">Checking authentication...</div>
          </Show>
        </div>

        <Divider />

        {/* ── Install ──────────────────────────────────────────── */}
        <div class={!apiKey() && props.user ? "opacity-40 pointer-events-none select-none" : !props.user ? "opacity-40 pointer-events-none select-none" : ""}>
          <h2 class="text-sm font-bold mb-1">Install</h2>
          <p class="text-[11px] text-text-dim mb-4">
            Two copy-pastes. Takes 10 seconds.
          </p>

          <div class="space-y-4">
            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="w-5 h-5 rounded-full bg-safe/20 text-safe flex items-center justify-center text-[10px] font-bold">1</span>
                <span class="text-[11px] text-text-label">Download the hook + set your key</span>
              </div>
              <CopyBlock text={installCmd()} label="Run in terminal" />
            </div>

            <div>
              <div class="flex items-center gap-2 mb-2">
                <span class="w-5 h-5 rounded-full bg-safe/20 text-safe flex items-center justify-center text-[10px] font-bold">2</span>
                <span class="text-[11px] text-text-label">Add hooks to Claude Code</span>
              </div>
              <CopyBlock label="Add to ~/.claude/settings.json" text={settingsSnippet()} />
            </div>
          </div>
        </div>

        <Divider />

        {/* ── Verify ───────────────────────────────────────────── */}
        <div class={!apiKey() ? "opacity-40 pointer-events-none select-none" : ""}>
          <h2 class="text-sm font-bold mb-1">Verify</h2>
          <p class="text-[11px] text-text-dim mb-4">
            Start any Claude Code session. It will appear here automatically within seconds. This page is live — no refresh needed.
          </p>
          <div class="flex items-center gap-3 text-[11px]">
            <span class="w-2 h-2 rounded-full bg-safe animate-pulse" />
            <span class="text-text-dim">Listening for events via WebSocket...</span>
          </div>
        </div>

        {/* Bottom spacing */}
        <div class="h-16" />
      </div>
    </div>
  );
};
