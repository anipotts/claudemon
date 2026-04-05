import { type Component, createSignal, Show, For, onMount, onCleanup } from "solid-js";
import { X, Copy, Check, Trash, Plus, Key, Info, ArrowSquareOut, Warning } from "./Icons";

// ── Helpers ────────────────────────────────────────────────────────

function CopyBtn(props: { text: string; size?: number }) {
  const [copied, setCopied] = createSignal(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(props.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} class="p-1 rounded transition-all" title="Copy to clipboard">
      {copied() ? (
        <Check size={props.size || 12} class="text-safe" />
      ) : (
        <Copy size={props.size || 12} class="text-text-sub hover:text-text-primary" />
      )}
    </button>
  );
}

function StatusDot(props: { status: "ok" | "warn" | "error" }) {
  const color = () => {
    switch (props.status) {
      case "ok":
        return "bg-safe";
      case "warn":
        return "bg-suspicious";
      case "error":
        return "bg-attack";
    }
  };
  const shadow = () => {
    switch (props.status) {
      case "ok":
        return "0 0 6px var(--safe)";
      case "warn":
        return "0 0 6px var(--suspicious)";
      case "error":
        return "0 0 6px var(--attack)";
    }
  };
  return <span class={`w-2 h-2 rounded-full ${color()}`} style={{ "box-shadow": shadow() }} />;
}

function DiagRow(props: { label: string; children: any }) {
  return (
    <div class="flex items-start gap-3 py-2 border-b border-panel-border/30 last:border-b-0">
      <span class="text-[10px] text-text-sub uppercase tracking-wider w-[90px] shrink-0 pt-0.5">{props.label}</span>
      <div class="flex-1 min-w-0 text-[12px] text-text-primary">{props.children}</div>
    </div>
  );
}

// ── Types ──────────────────────────────────────────────────────────

interface User {
  sub: string;
  name: string;
  login: string;
  avatar_url: string;
  has_api_keys?: boolean;
}

interface ApiKeyEntry {
  id: string;
  label: string;
  prefix: string;
  created_at: string;
  last_used_at?: string;
}

interface HealthResponse {
  ok: boolean;
  version?: string;
  status?: string;
}

type TabId = "connection" | "api-keys" | "about";

// ── Settings Panel ────────────────────────────────────────────────

export const SettingsPanel: Component<{
  apiUrl: string;
  user: User | null;
  connectionStatus: () => string;
  onClose: () => void;
}> = (props) => {
  const [activeTab, setActiveTab] = createSignal<TabId>("connection");

  // Close on Escape key
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") props.onClose();
  };
  onMount(() => document.addEventListener("keydown", handleKeyDown));
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown));

  const tabs: Array<{ id: TabId; label: string }> = [
    { id: "connection", label: "Connection" },
    { id: "api-keys", label: "API Keys" },
    { id: "about", label: "About" },
  ];

  return (
    <div class="settings-overlay" onClick={props.onClose}>
      <div class="settings-panel" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div class="flex items-center justify-between px-4 py-3 border-b border-panel-border">
          <span class="text-[13px] font-bold text-text-primary tracking-wider">Settings</span>
          <button
            onClick={props.onClose}
            class="text-text-sub hover:text-text-primary transition-colors p-1"
            title="Close"
            aria-label="Close settings"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tabs */}
        <div class="flex items-center gap-1 px-4 pt-3 pb-0">
          <For each={tabs}>
            {(tab) => (
              <button
                onClick={() => setActiveTab(tab.id)}
                class={`px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  activeTab() === tab.id ? "bg-safe/15 text-safe" : "text-text-sub hover:text-text-primary"
                }`}
              >
                {tab.label}
              </button>
            )}
          </For>
        </div>

        {/* Tab content */}
        <div class="flex-1 overflow-y-auto smooth-scroll px-4 py-4">
          <Show when={activeTab() === "connection"}>
            <ConnectionTab apiUrl={props.apiUrl} user={props.user} connectionStatus={props.connectionStatus} />
          </Show>
          <Show when={activeTab() === "api-keys"}>
            <ApiKeysTab apiUrl={props.apiUrl} />
          </Show>
          <Show when={activeTab() === "about"}>
            <AboutTab apiUrl={props.apiUrl} />
          </Show>
        </div>
      </div>
    </div>
  );
};

// ── Connection Tab ────────────────────────────────────────────────

const ConnectionTab: Component<{
  apiUrl: string;
  user: User | null;
  connectionStatus: () => string;
}> = (props) => {
  const [health, setHealth] = createSignal<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = createSignal(true);
  const [authInfo, setAuthInfo] = createSignal<{ method: string; userId: string; room: string }>({
    method: "Unknown",
    userId: "Anonymous",
    room: "global",
  });

  const apiKey = () => (typeof localStorage !== "undefined" ? localStorage.getItem("claudemon_api_key") : null);

  const maskedKey = () => {
    const key = apiKey();
    if (!key) return null;
    return key.slice(0, 8) + "...";
  };

  const wsUrl = () => {
    const key = apiKey();
    const base = import.meta.env.DEV ? "ws://localhost:8787/ws" : "wss://api.claudemon.com/ws";
    if (key) return `${base}?token=${key.slice(0, 8)}...`;
    return base;
  };

  const wsStatusLabel = () => {
    switch (props.connectionStatus()) {
      case "connected":
        return "Connected";
      case "connecting":
        return "Connecting";
      default:
        return "Disconnected";
    }
  };

  const wsStatusColor = (): "ok" | "warn" | "error" => {
    switch (props.connectionStatus()) {
      case "connected":
        return "ok";
      case "connecting":
        return "warn";
      default:
        return "error";
    }
  };

  // Determine auth method and user context
  const deriveAuth = () => {
    const key = apiKey();
    if (props.user) {
      setAuthInfo({
        method: key ? "Cookie + API Key" : "Cookie (GitHub OAuth)",
        userId: props.user.login,
        room: `user:${props.user.sub}`,
      });
    } else if (key) {
      setAuthInfo({
        method: "API Key",
        userId: "Authenticated (no profile)",
        room: "user-scoped",
      });
    } else {
      setAuthInfo({
        method: "Anonymous",
        userId: "Anonymous",
        room: "global (shared)",
      });
    }
  };

  onMount(async () => {
    deriveAuth();

    // Health check
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${props.apiUrl}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        setHealth({ ok: true, version: data.version, status: data.status });
      } else {
        setHealth({ ok: false });
      }
    } catch {
      setHealth({ ok: false });
    } finally {
      setHealthLoading(false);
    }
  });

  const hasWarnings = () => {
    const key = apiKey();
    const h = health();
    return !key || (h && !h.ok) || authInfo().method === "Anonymous";
  };

  return (
    <div>
      <Show when={hasWarnings()}>
        <div class="flex items-start gap-2.5 bg-suspicious/8 border border-suspicious/25 rounded px-3 py-2.5 mb-4">
          <Warning size={14} class="text-suspicious shrink-0 mt-0.5" />
          <div class="text-[11px] text-suspicious leading-relaxed">
            <Show when={!apiKey()}>
              <p class="mb-1">
                <span class="font-bold">No API key set.</span> Go to the API Keys tab to create one, or run{" "}
                <code class="bg-suspicious/15 px-1 rounded">claudemon-cli init</code> to configure your CLI.
              </p>
            </Show>
            <Show when={health() && !health()!.ok}>
              <p class="mb-1">
                <span class="font-bold">Health check failed.</span> The API at {props.apiUrl} may be down or
                unreachable.
              </p>
            </Show>
            <Show when={authInfo().method === "Anonymous"}>
              <p>
                <span class="font-bold">Anonymous session.</span> Sign in with GitHub to get a private room for your
                sessions.
              </p>
            </Show>
          </div>
        </div>
      </Show>

      <DiagRow label="WebSocket">
        <div class="flex items-center gap-2">
          <StatusDot status={wsStatusColor()} />
          <span class={props.connectionStatus() === "connected" ? "text-safe" : "text-suspicious"}>
            {wsStatusLabel()}
          </span>
        </div>
      </DiagRow>

      <DiagRow label="WS URL">
        <span class="text-[11px] text-text-dim font-mono break-all">{wsUrl()}</span>
      </DiagRow>

      <DiagRow label="API URL">
        <span class="text-[11px] text-text-dim font-mono">{props.apiUrl}</span>
      </DiagRow>

      <DiagRow label="Health">
        <Show when={!healthLoading()} fallback={<span class="text-[11px] text-text-sub">Checking...</span>}>
          <Show
            when={health()?.ok}
            fallback={
              <div class="flex items-center gap-2">
                <StatusDot status="error" />
                <span class="text-attack text-[11px]">Unreachable</span>
              </div>
            }
          >
            <div class="flex items-center gap-2">
              <StatusDot status="ok" />
              <span class="text-safe text-[11px]">
                OK{health()?.version ? ` (v${health()!.version})` : ""}
                {health()?.status ? ` - ${health()!.status}` : ""}
              </span>
            </div>
          </Show>
        </Show>
      </DiagRow>

      <DiagRow label="Auth">
        <span class="text-[11px]">{authInfo().method}</span>
      </DiagRow>

      <DiagRow label="API Key">
        <Show when={apiKey()} fallback={<span class="text-[11px] text-attack font-bold">Not set</span>}>
          <div class="flex items-center gap-2">
            <code class="text-[11px] text-safe font-mono">{maskedKey()}</code>
            <CopyBtn text={apiKey()!} size={11} />
          </div>
        </Show>
      </DiagRow>

      <DiagRow label="User">
        <Show when={props.user} fallback={<span class="text-[11px] text-text-sub">Anonymous</span>}>
          {(u) => (
            <div class="flex items-center gap-2">
              <img src={u().avatar_url} alt={u().login} class="w-4 h-4 rounded-full border border-panel-border" />
              <span class="text-[11px]">{u().login}</span>
            </div>
          )}
        </Show>
      </DiagRow>

      <DiagRow label="Room">
        <span class="text-[11px] text-text-dim font-mono">{authInfo().room}</span>
      </DiagRow>
    </div>
  );
};

// ── API Keys Tab ──────────────────────────────────────────────────

const ApiKeysTab: Component<{ apiUrl: string }> = (props) => {
  const [keys, setKeys] = createSignal<ApiKeyEntry[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [creating, setCreating] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [newKeyLabel, setNewKeyLabel] = createSignal("");
  const [deletingId, setDeletingId] = createSignal<string | null>(null);

  const activeKey = () => (typeof localStorage !== "undefined" ? localStorage.getItem("claudemon_api_key") : null);

  const fetchKeys = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${props.apiUrl}/auth/api-keys`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys || []);
      } else if (res.status === 401) {
        setError("Sign in with GitHub to manage API keys.");
      } else {
        setError("Failed to fetch API keys.");
      }
    } catch {
      setError("Could not reach the API.");
    } finally {
      setLoading(false);
    }
  };

  onMount(fetchKeys);

  const createKey = async () => {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`${props.apiUrl}/auth/api-keys`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newKeyLabel() || "settings-panel" }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.key) {
          localStorage.setItem("claudemon_api_key", data.key);
        }
        setNewKeyLabel("");
        await fetchKeys();
      } else {
        setError("Failed to create key.");
      }
    } catch {
      setError("Could not reach the API.");
    } finally {
      setCreating(false);
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm("Delete this API key? Any hooks using it will stop working.")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${props.apiUrl}/auth/api-keys/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (res.ok) {
        await fetchKeys();
      } else {
        setError("Failed to delete key.");
      }
    } catch {
      setError("Could not reach the API.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <Show when={error()}>
        <div class="flex items-start gap-2 bg-attack/8 border border-attack/25 rounded px-3 py-2 mb-4">
          <Warning size={12} class="text-attack shrink-0 mt-0.5" />
          <span class="text-[11px] text-attack">{error()}</span>
        </div>
      </Show>

      <Show when={activeKey()}>
        <div class="bg-safe/5 border border-safe/20 rounded px-3 py-2 mb-4">
          <div class="text-[9px] text-text-sub uppercase tracking-wider mb-1">Active in browser</div>
          <div class="flex items-center gap-2">
            <code class="text-[11px] text-safe font-mono flex-1 truncate">{activeKey()!.slice(0, 8)}...</code>
            <CopyBtn text={activeKey()!} size={11} />
          </div>
        </div>
      </Show>

      <Show when={!loading()} fallback={<div class="py-8 text-center text-[11px] text-text-sub">Loading keys...</div>}>
        <Show
          when={keys().length > 0}
          fallback={<div class="py-6 text-center text-[11px] text-text-sub">No API keys found. Create one below.</div>}
        >
          <div class="space-y-1.5 mb-4">
            <For each={keys()}>
              {(key) => {
                const isActive = () => activeKey()?.startsWith(key.prefix);
                return (
                  <div
                    class={`flex items-center gap-3 px-3 py-2 rounded border transition-colors ${
                      isActive() ? "bg-safe/5 border-safe/20" : "bg-card border-panel-border/30"
                    }`}
                  >
                    <Key size={12} class={isActive() ? "text-safe" : "text-text-sub"} />
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2">
                        <code class="text-[11px] font-mono text-text-primary truncate">{key.prefix}...</code>
                        <Show when={isActive()}>
                          <span class="text-[8px] text-safe uppercase tracking-wider font-bold bg-safe/10 px-1.5 py-0.5 rounded">
                            active
                          </span>
                        </Show>
                      </div>
                      <div class="flex items-center gap-3 mt-0.5">
                        <span class="text-[9px] text-text-sub">{key.label}</span>
                        <span class="text-[9px] text-text-dim">{new Date(key.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteKey(key.id)}
                      disabled={deletingId() === key.id}
                      class="p-1 text-text-sub hover:text-attack transition-colors disabled:opacity-30"
                      title="Delete key"
                    >
                      <Trash size={12} />
                    </button>
                  </div>
                );
              }}
            </For>
          </div>
        </Show>

        {/* Create new key */}
        <div class="border-t border-panel-border/30 pt-4">
          <div class="text-[10px] text-text-sub uppercase tracking-wider mb-2">Create new key</div>
          <div class="flex items-center gap-2">
            <input
              type="text"
              value={newKeyLabel()}
              onInput={(e) => setNewKeyLabel(e.currentTarget.value)}
              placeholder="Label (optional)"
              class="flex-1 bg-input-bg border border-panel-border/50 rounded px-3 py-1.5 text-[11px] text-text-primary placeholder:text-text-dim font-mono outline-none focus:border-safe/40"
            />
            <button
              onClick={createKey}
              disabled={creating()}
              class="flex items-center gap-1.5 bg-safe/15 border border-safe/30 rounded px-3 py-1.5 text-[11px] font-bold text-safe hover:bg-safe/25 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Plus size={11} />
              {creating() ? "Creating..." : "Create"}
            </button>
          </div>
        </div>
      </Show>
    </div>
  );
};

// ── About Tab ─────────────────────────────────────────────────────

const AboutTab: Component<{ apiUrl: string }> = (props) => {
  const [version, setVersion] = createSignal<string | null>(null);

  onMount(async () => {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${props.apiUrl}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data.version) setVersion(data.version);
      }
    } catch {
      // Ignore — version will show as unknown
    }
  });

  return (
    <div>
      <div class="flex items-center gap-2.5 mb-5">
        <span class="text-lg font-bold tracking-wider text-text-primary">ClaudeMon</span>
      </div>

      <p class="text-[12px] text-text-dim mb-5 leading-relaxed">
        Monitor your Claude Code sessions in real time. Privacy-first, ephemeral WebSocket relay with no persistent
        database.
      </p>

      <div class="space-y-0.5 mb-5">
        <DiagRow label="API version">
          <span class="text-[11px] font-mono">{version() ? `v${version()}` : "Unknown"}</span>
        </DiagRow>
        <DiagRow label="CLI">
          <span class="text-[11px] font-mono text-text-dim">claudemon-cli</span>
          <span class="text-[9px] text-text-sub ml-2">npm install -g claudemon-cli</span>
        </DiagRow>
        <DiagRow label="License">
          <span class="text-[11px]">MIT License</span>
        </DiagRow>
      </div>

      <div class="border-t border-panel-border/30 pt-4">
        <div class="text-[10px] text-text-sub uppercase tracking-wider mb-3">Links</div>
        <div class="space-y-2">
          <a
            href="https://github.com/claudemon/claudemon"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 text-[11px] text-text-dim hover:text-text-primary transition-colors"
          >
            <ArrowSquareOut size={12} />
            GitHub Repository
          </a>
          <a
            href="https://www.npmjs.com/package/claudemon-cli"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 text-[11px] text-text-dim hover:text-text-primary transition-colors"
          >
            <ArrowSquareOut size={12} />
            npm: claudemon-cli
          </a>
          <a
            href="https://claudemon.com"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 text-[11px] text-text-dim hover:text-text-primary transition-colors"
          >
            <ArrowSquareOut size={12} />
            claudemon.com
          </a>
          <a
            href="https://app.claudemon.com"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-2 text-[11px] text-text-dim hover:text-text-primary transition-colors"
          >
            <ArrowSquareOut size={12} />
            app.claudemon.com
          </a>
        </div>
      </div>

      <div class="mt-6 pt-4 border-t border-panel-border/30">
        <div class="flex items-center gap-2 text-[10px] text-text-dim">
          <Info size={11} />
          <span>Open source -- MIT License</span>
        </div>
      </div>
    </div>
  );
};
