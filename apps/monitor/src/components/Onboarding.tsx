import { type Component, createSignal, Show } from "solid-js";
import { ShieldCheck, Copy, Check, Eye, Lightning, TreeStructure } from "./Icons";

const API_URL = import.meta.env.VITE_MONITOR_API_URL || "https://api.claudemon.com";

// ── Syntax-highlighted JSON (Anthropic docs style) ──────────────────

function JsonBlock(props: { json: string; label?: string }) {
  const [copied, setCopied] = createSignal(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(props.json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Tokenize JSON for syntax highlighting
  const highlighted = () => {
    return props.json
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      // strings (keys and values)
      .replace(/"([^"]*)"(\s*:)/g, '<span class="json-key">"$1"</span>$2')
      .replace(/"([^"]*)"/g, '<span class="json-str">"$1"</span>')
      // booleans
      .replace(/\b(true|false)\b/g, '<span class="json-bool">$1</span>')
      // numbers
      .replace(/:\s*(\d+)/g, ': <span class="json-num">$1</span>')
      // punctuation
      .replace(/([{}[\],])/g, '<span class="json-punc">$1</span>');
  };

  return (
    <div class="group relative">
      <Show when={props.label}>
        <div class="text-[9px] text-text-sub uppercase tracking-wider mb-1.5">{props.label}</div>
      </Show>
      <div class="relative bg-[#0e0d0c] border border-panel-border/50 rounded overflow-hidden">
        <pre
          class="px-4 py-3 text-[12px] leading-[1.7] overflow-x-auto font-mono"
          innerHTML={highlighted()}
        />
        <button
          onClick={handleCopy}
          class="absolute top-2.5 right-2.5 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-panel-border/20 hover:bg-panel-border/40"
        >
          {copied() ? <Check size={13} class="text-safe" /> : <Copy size={13} class="text-text-sub" />}
        </button>
      </div>
    </div>
  );
}

// ── Simple copy block for terminal commands ─────────────────────────

function CmdBlock(props: { text: string; label?: string }) {
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
      <div class="relative bg-[#0e0d0c] border border-panel-border/50 rounded">
        <pre class="px-4 py-3 text-[12px] text-text-primary leading-[1.6] whitespace-pre-wrap break-all font-mono">{props.text}</pre>
        <button
          onClick={handleCopy}
          class="absolute top-2.5 right-2.5 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-panel-border/20 hover:bg-panel-border/40"
        >
          {copied() ? <Check size={13} class="text-safe" /> : <Copy size={13} class="text-text-sub" />}
        </button>
      </div>
    </div>
  );
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
  const [showSource, setShowSource] = createSignal(false);
  const [hookSrc, setHookSrc] = createSignal<string | null>(null);

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

  const loadSource = async () => {
    if (hookSrc()) { setShowSource(!showSource()); return; }
    try {
      const res = await fetch(`${props.apiUrl}/hook.sh`);
      setHookSrc(await res.text());
      setShowSource(true);
    } catch {}
  };

  const installCmd = () => {
    const key = apiKey();
    if (key) {
      return `curl -fsSL ${props.apiUrl}/hook.sh -o ~/.claudemon-hook.sh && chmod +x ~/.claudemon-hook.sh\n\n# Add to ~/.zshrc or ~/.bashrc\nexport CLAUDEMON_API_KEY="${key}"`;
    }
    return `curl -fsSL ${props.apiUrl}/hook.sh -o ~/.claudemon-hook.sh && chmod +x ~/.claudemon-hook.sh`;
  };

  const settingsJson = () => JSON.stringify({
    hooks: {
      PreToolUse: [{ matcher: "", hooks: [{ type: "command", command: "bash ~/.claudemon-hook.sh", async: true }] }],
      PostToolUse: [{ matcher: "", hooks: [{ type: "command", command: "bash ~/.claudemon-hook.sh", async: true }] }],
      Notification: [{ matcher: "", hooks: [{ type: "command", command: "bash ~/.claudemon-hook.sh", async: true }] }],
      Stop: [{ matcher: "", hooks: [{ type: "command", command: "bash ~/.claudemon-hook.sh", async: true }] }],
    }
  }, null, 2);

  const ready = () => !!apiKey();

  return (
    <div class="flex-1 flex flex-col items-center overflow-y-auto smooth-scroll">
      <div class="w-full max-w-[540px] px-6 py-12">

        {/* ── Hero — minimal ──────────────────────────────────── */}
        <div class="text-center mb-10">
          <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-safe/10 border border-safe/20 mb-4">
            <ShieldCheck size={24} class="text-safe" />
          </div>
          <h1 class="text-xl font-bold tracking-wide mb-1.5">ClaudeMon</h1>
          <p class="text-[12px] text-text-dim leading-5">
            Monitor your Claude Code sessions in real time
          </p>
          <div class="flex justify-center gap-6 mt-4 text-[10px]">
            <span class="flex items-center gap-1.5 text-text-sub">
              <TreeStructure size={12} class="text-safe" /> Agent Map
            </span>
            <span class="flex items-center gap-1.5 text-text-sub">
              <Eye size={12} class="text-suspicious" /> Live Activity
            </span>
            <span class="flex items-center gap-1.5 text-text-sub">
              <Lightning size={12} class="text-attack" /> Conflicts
            </span>
          </div>
        </div>

        {/* ── Privacy — compact two-column ─────────────────────── */}
        <div class="mb-8">
          <h2 class="text-[12px] font-bold uppercase tracking-wider text-text-label mb-3">What the hook sends</h2>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] mb-3">
            <span class="text-text-dim">session_id, machine_id</span>
            <span class="text-text-sub">identify session + machine</span>
            <span class="text-text-dim">project_path, branch</span>
            <span class="text-text-sub">which repo and branch</span>
            <span class="text-text-dim">tool_name, tool_input</span>
            <span class="text-text-sub">which tool + its arguments</span>
            <span class="text-text-dim">tool_response</span>
            <span class="text-text-sub">what the tool returned</span>
            <span class="text-text-dim">hook_event_name, model</span>
            <span class="text-text-sub">event type + model name</span>
          </div>
          <div class="text-[11px] text-text-sub mb-3">
            <span class="text-attack">Never sent:</span>{" "}
            file contents, API keys, env vars, your conversation with Claude.
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-text-dim">
            <span class="flex items-center gap-1"><ShieldCheck size={10} class="text-safe" /> Ephemeral — auto-purges after 1hr</span>
            <span class="flex items-center gap-1"><ShieldCheck size={10} class="text-safe" /> Open source</span>
            <span class="flex items-center gap-1"><ShieldCheck size={10} class="text-safe" /> Self-hostable</span>
          </div>
          <button
            onClick={loadSource}
            class="mt-2 text-[10px] text-safe/70 hover:text-safe transition-colors cursor-pointer"
          >
            {showSource() ? "Hide hook source" : "Read the full hook source code"}
          </button>
          <Show when={showSource() && hookSrc()}>
            <div class="mt-2 bg-[#0e0d0c] border border-panel-border/40 rounded p-3 max-h-[250px] overflow-y-auto smooth-scroll">
              <pre class="text-[10px] text-text-dim leading-4 whitespace-pre-wrap break-all">{hookSrc()}</pre>
            </div>
          </Show>
        </div>

        {/* ── Divider ─────────────────────────────────────────── */}
        <div class="border-t border-panel-border/30 mb-8" />

        {/* ── Auth + API key ──────────────────────────────────── */}
        <div class="mb-8">
          <h2 class="text-[12px] font-bold uppercase tracking-wider text-text-label mb-3">
            {props.user ? "API Key" : "Sign in"}
          </h2>

          <Show when={!props.authLoading}>
            <Show when={props.user} fallback={
              <div>
                <p class="text-[11px] text-text-dim mb-3">
                  Sign in to create an API key. Events without a valid key are rejected.
                </p>
                <a
                  href={`${props.apiUrl}/auth/login?redirect=${encodeURIComponent(window.location.href)}`}
                  class="inline-flex items-center gap-2 bg-[#161b22] border border-[#30363d] rounded px-4 py-2 text-[12px] text-white hover:bg-[#1c2128] transition-colors"
                >
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" /></svg>
                  Sign in with GitHub
                </a>
              </div>
            }>
              {(u) => (
                <div>
                  <div class="flex items-center gap-2 mb-3 text-[11px]">
                    <img src={u().avatar_url} alt={u().login} class="w-5 h-5 rounded-full border border-panel-border" />
                    <span class="text-text-label">{u().login}</span>
                    <Check size={11} class="text-safe" />
                  </div>

                  <Show when={!apiKey()} fallback={
                    <div>
                      <div class="text-[10px] text-safe font-bold uppercase tracking-wider mb-1.5">Your key (shown once — copy now)</div>
                      <CmdBlock text={apiKey()!} />
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
        </div>

        {/* ── Divider ─────────────────────────────────────────── */}
        <div class="border-t border-panel-border/30 mb-8" />

        {/* ── Install ─────────────────────────────────────────── */}
        <div class={`mb-8 transition-opacity ${ready() ? "" : "opacity-30 pointer-events-none select-none"}`}>
          <h2 class="text-[12px] font-bold uppercase tracking-wider text-text-label mb-3">Install</h2>

          <div class="space-y-4">
            <CmdBlock label="1. Download hook + set API key" text={installCmd()} />
            <JsonBlock label="2. Add to ~/.claude/settings.json" json={settingsJson()} />
          </div>

          <p class="text-[10px] text-text-sub mt-3">
            The hook runs async on each tool call. Non-blocking, under 50ms overhead.
          </p>
        </div>

        {/* ── Divider ─────────────────────────────────────────── */}
        <div class="border-t border-panel-border/30 mb-8" />

        {/* ── Verify ──────────────────────────────────────────── */}
        <div class={`transition-opacity ${ready() ? "" : "opacity-30 pointer-events-none select-none"}`}>
          <h2 class="text-[12px] font-bold uppercase tracking-wider text-text-label mb-2">Verify</h2>
          <p class="text-[11px] text-text-dim mb-3">
            Start any Claude Code session. It appears here automatically.
          </p>
          <div class="flex items-center gap-2 text-[11px]">
            <span class="w-2 h-2 rounded-full bg-safe animate-pulse" />
            <span class="text-text-dim">Listening via WebSocket...</span>
          </div>
        </div>

        <div class="h-12" />
      </div>
    </div>
  );
};
