import { type Component, Show, createMemo, createSignal, onMount } from "solid-js";
import { Check, Copy } from "./Icons";

interface User {
  sub: string;
  name: string;
  login: string;
  avatar_url: string;
  has_api_keys?: boolean;
}

interface SetupScreenProps {
  onApiKeySet: (key: string) => void;
  connectionStatus: () => string;
  apiUrl: string;
  user: User | null;
  authLoading: boolean;
}

/**
 * ClaudeMon v0.7 onboarding — single-screen, three-state flow.
 *
 *   (1) welcome         — not signed in → big "Continue with GitHub" CTA
 *   (2) authenticating  — returning from OAuth, auto-minting a key
 *   (3) ready           — signed in + key in hand → one paste-able install block
 *
 * Previous version required 5 context switches (sign in → find settings →
 * create key → copy key → paste back). This flow has one primary action at
 * each step and auto-progresses to the end.
 */
export const SetupScreen: Component<SetupScreenProps> = (props) => {
  const [apiKey, setApiKey] = createSignal<string | null>(null);
  const [minting, setMinting] = createSignal(false);
  const [mintError, setMintError] = createSignal<string | null>(null);
  const [showAdvanced, setShowAdvanced] = createSignal(false);
  const [manualKey, setManualKey] = createSignal("");
  const [copied, setCopied] = createSignal<string | null>(null); // which block was copied

  const connected = () => props.connectionStatus() === "connected";

  // Auto-capture ?key= URL param (for key sharing flows)
  onMount(() => {
    const url = new URL(window.location.href);
    const key = url.searchParams.get("key");
    if (key) {
      url.searchParams.delete("key");
      window.history.replaceState({}, "", url.toString());
      props.onApiKeySet(key);
    }
  });

  // When we discover a signed-in user with no keys, auto-mint one.
  // If they already have keys, surface a "Generate new key" CTA but don't auto-create.
  const shouldAutoMint = createMemo(() => {
    return !!props.user && !props.user.has_api_keys && !apiKey() && !minting() && !mintError();
  });

  // Fire auto-mint effect
  createMemo(() => {
    if (shouldAutoMint()) {
      void mintKey("first-key");
    }
  });

  async function mintKey(label: string) {
    if (minting()) return;
    setMinting(true);
    setMintError(null);
    try {
      const res = await fetch(`${props.apiUrl}/auth/api-keys`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { key?: string };
      if (!data.key) throw new Error("No key returned");
      setApiKey(data.key);
      props.onApiKeySet(data.key);
    } catch (err) {
      setMintError(err instanceof Error ? err.message : "Failed to create key");
    } finally {
      setMinting(false);
    }
  }

  const signInUrl = () => `${props.apiUrl}/auth/login?redirect=${encodeURIComponent(window.location.href)}`;

  function copy(text: string, block: string) {
    navigator.clipboard.writeText(text);
    setCopied(block);
    setTimeout(() => setCopied(null), 1800);
  }

  const marketplaceCmd = "/plugin marketplace add anipotts/claudemon";
  const installCmd = "/plugin install claudemon@anipotts";
  const allCmds = () => `${marketplaceCmd}\n${installCmd}\n\n# API key (paste when prompted):\n${apiKey() || ""}`;

  function submitManualKey() {
    const k = manualKey().trim();
    if (k) props.onApiKeySet(k);
  }

  return (
    <div
      class="flex-1 flex flex-col items-center justify-center px-8 overflow-y-auto"
      style={{ background: "var(--bg)" }}
    >
      <div class="w-full max-w-xl py-12 space-y-10">
        {/* ── Brand ─────────────────────────────────────────────── */}
        <div class="text-center space-y-2">
          <div class="font-mono text-[20px] font-semibold tracking-tight" style={{ color: "var(--suspicious)" }}>
            claudemon
          </div>
          <div class="text-[10px] uppercase tracking-[0.22em] text-text-sub">mission control · multi-session</div>
        </div>

        {/* ── State 1: Welcome (not signed in) ────────────────── */}
        <Show when={!props.authLoading && !props.user}>
          <div class="space-y-6">
            <a href={signInUrl()} class="block w-full">
              <div
                class="flex items-center justify-center gap-3 px-5 py-4 rounded border font-mono text-[13px] transition-colors cursor-pointer"
                style={{
                  background: "#0c0c0c",
                  "border-color": "var(--panel-border)",
                  color: "var(--text-primary)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--suspicious)")}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--panel-border)")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.24c-3.33.72-4.03-1.41-4.03-1.41-.55-1.38-1.34-1.75-1.34-1.75-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.17 0 0 1.01-.32 3.3 1.23a11.47 11.47 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.65.25 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.22.7.83.58A12.01 12.01 0 0024 12.5C24 5.87 18.63.5 12 .5z" />
                </svg>
                Continue with GitHub
              </div>
            </a>

            <p class="text-[11px] text-center text-text-dim leading-relaxed">
              Sign in with GitHub · we'll generate your API key automatically.
              <br />
              <span class="text-text-sub">No email required. Only your public profile.</span>
            </p>

            {/* Trust line */}
            <div class="flex items-center justify-center gap-2 pt-1 text-[9px] text-text-sub uppercase tracking-wider">
              <span>ephemeral relay</span>
              <span>·</span>
              <span>encrypted at rest</span>
              <span>·</span>
              <span>no conversation data</span>
            </div>

            {/* Advanced: paste existing key */}
            <details
              open={showAdvanced()}
              onToggle={(e) => setShowAdvanced((e.currentTarget as HTMLDetailsElement).open)}
              class="pt-2"
            >
              <summary class="text-[10px] text-text-sub hover:text-text-label cursor-pointer list-none select-none text-center transition-colors">
                I already have an API key
              </summary>
              <div class="mt-3 flex gap-2">
                <input
                  type="text"
                  placeholder="cm_..."
                  value={manualKey()}
                  onInput={(e) => setManualKey(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitManualKey()}
                  class="flex-1 bg-[#0c0c0c] border border-panel-border/40 rounded px-3 py-2 font-mono text-[11px] text-text-primary placeholder:text-text-sub/40 outline-none focus:border-safe/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={submitManualKey}
                  disabled={!manualKey().trim()}
                  class="px-3 py-2 bg-safe/15 border border-safe/30 rounded text-[10px] font-mono text-safe hover:bg-safe/25 disabled:opacity-40 disabled:cursor-default transition-colors"
                >
                  Connect
                </button>
              </div>
            </details>
          </div>
        </Show>

        {/* ── State 2: Authenticating / minting key ─────────────── */}
        <Show when={props.authLoading || (props.user && minting())}>
          <div class="flex flex-col items-center gap-4 py-8">
            <div class="flex items-center gap-3">
              <Show when={props.user?.avatar_url}>
                <img
                  src={props.user!.avatar_url}
                  alt=""
                  class="w-8 h-8 rounded-full"
                  style={{ border: "1px solid var(--panel-border)" }}
                />
              </Show>
              <Show when={props.user}>
                <span class="text-[12px] text-text-primary font-mono">@{props.user!.login}</span>
              </Show>
            </div>
            <div class="flex items-center gap-2">
              <span class="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--suspicious)" }} />
              <span class="text-[11px] text-text-dim">
                {minting() ? "Generating your API key..." : "Signing you in..."}
              </span>
            </div>
          </div>
        </Show>

        {/* ── State 3: Ready — key in hand, show install block ──── */}
        <Show when={props.user && apiKey() && !minting()}>
          <div class="space-y-5">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <img
                  src={props.user!.avatar_url}
                  alt=""
                  class="w-7 h-7 rounded-full"
                  style={{ border: "1px solid var(--panel-border)" }}
                />
                <span class="text-[11px] text-text-label font-mono">Signed in as @{props.user!.login}</span>
              </div>
              <a
                href={`${props.apiUrl}/auth/logout`}
                class="text-[9px] text-text-sub hover:text-text-label transition-colors uppercase tracking-wider"
              >
                Sign out
              </a>
            </div>

            <div class="space-y-2">
              <div class="text-[10px] uppercase tracking-wider text-text-sub flex items-center justify-between">
                <span>Paste this into Claude Code</span>
                <button
                  type="button"
                  onClick={() => copy(allCmds(), "all")}
                  class="flex items-center gap-1 text-[10px] text-safe hover:text-text-primary transition-colors"
                >
                  {copied() === "all" ? (
                    <>
                      <Check size={11} /> Copied
                    </>
                  ) : (
                    <>
                      <Copy size={11} /> Copy all
                    </>
                  )}
                </button>
              </div>

              <div
                class="rounded border p-4 font-mono text-[11px] space-y-3"
                style={{
                  background: "#0c0c0c",
                  "border-color": "var(--panel-border)",
                }}
              >
                <div style={{ color: "var(--safe)" }}>
                  <div class="text-text-sub text-[10px] mb-1"># 1. Add the marketplace</div>
                  <div class="flex items-start gap-2">
                    <span class="text-text-sub shrink-0">$</span>
                    <span class="flex-1 break-all">{marketplaceCmd}</span>
                    <button
                      type="button"
                      onClick={() => copy(marketplaceCmd, "market")}
                      class="text-text-sub hover:text-text-primary transition-colors shrink-0"
                    >
                      {copied() === "market" ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>

                <div style={{ color: "var(--safe)" }}>
                  <div class="text-text-sub text-[10px] mb-1"># 2. Install the plugin</div>
                  <div class="flex items-start gap-2">
                    <span class="text-text-sub shrink-0">$</span>
                    <span class="flex-1 break-all">{installCmd}</span>
                    <button
                      type="button"
                      onClick={() => copy(installCmd, "install")}
                      class="text-text-sub hover:text-text-primary transition-colors shrink-0"
                    >
                      {copied() === "install" ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>

                <div style={{ color: "var(--suspicious)" }}>
                  <div class="text-text-sub text-[10px] mb-1"># 3. When Claude Code prompts for an API key, paste:</div>
                  <div class="flex items-start gap-2">
                    <span class="text-text-sub shrink-0">›</span>
                    <span class="flex-1 break-all select-all">{apiKey()}</span>
                    <button
                      type="button"
                      onClick={() => copy(apiKey()!, "key")}
                      class="text-text-sub hover:text-text-primary transition-colors shrink-0"
                    >
                      {copied() === "key" ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={() => void mintKey("regenerated")}
                  class="text-[9px] text-text-sub hover:text-text-label transition-colors uppercase tracking-wider"
                >
                  Regenerate key
                </button>
                <span class="text-[9px] text-text-sub">
                  Optional: <code class="text-text-label">--channels plugin:claudemon@anipotts</code> for messaging
                </span>
              </div>
            </div>

            {/* Live listener */}
            <div
              class="flex items-center justify-center gap-2 pt-2 pb-1 rounded border"
              style={{
                padding: "10px",
                background: connected() ? "rgba(163, 177, 138, 0.06)" : "rgba(201, 169, 110, 0.06)",
                "border-color": connected() ? "rgba(163, 177, 138, 0.25)" : "rgba(201, 169, 110, 0.25)",
              }}
            >
              <span
                class="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{
                  background: connected() ? "var(--safe)" : "var(--suspicious)",
                  "box-shadow": connected() ? "0 0 6px var(--safe)" : "none",
                }}
              />
              <span class="text-[11px]" style={{ color: connected() ? "var(--safe)" : "var(--text-dim)" }}>
                {connected() ? "Listening for your first session" : "Waiting for connection..."}
              </span>
            </div>
          </div>
        </Show>

        {/* ── State 2.5: Signed in but key mint failed ──────────── */}
        <Show when={props.user && mintError() && !apiKey()}>
          <div class="space-y-3 text-center">
            <div class="text-[11px] text-attack">Could not auto-generate your API key.</div>
            <div class="text-[10px] text-text-dim">{mintError()}</div>
            <button
              type="button"
              onClick={() => void mintKey("manual")}
              class="px-4 py-2 bg-safe/15 border border-safe/30 rounded text-[11px] font-mono text-safe hover:bg-safe/25 transition-colors"
            >
              Try again
            </button>
          </div>
        </Show>

        {/* ── State 2.75: Signed in + already has keys + none freshly minted ── */}
        <Show when={props.user && props.user!.has_api_keys && !apiKey() && !minting() && !mintError()}>
          <div class="space-y-4 text-center">
            <div class="flex items-center justify-center gap-2.5">
              <img
                src={props.user!.avatar_url}
                alt=""
                class="w-7 h-7 rounded-full"
                style={{ border: "1px solid var(--panel-border)" }}
              />
              <span class="text-[11px] text-text-label font-mono">Welcome back, @{props.user!.login}</span>
            </div>
            <div class="text-[10px] text-text-dim">
              You already have an API key on another device.
              <br />
              Generate a new one here, or paste an existing key below.
            </div>
            <button
              type="button"
              onClick={() => void mintKey("new-device")}
              class="px-5 py-2.5 bg-safe/15 border border-safe/30 rounded text-[12px] font-mono text-safe hover:bg-safe/25 transition-colors"
            >
              Generate a new API key
            </button>
            <details class="pt-2">
              <summary class="text-[10px] text-text-sub hover:text-text-label cursor-pointer list-none text-center transition-colors">
                Or paste an existing key
              </summary>
              <div class="mt-3 flex gap-2 max-w-sm mx-auto">
                <input
                  type="text"
                  placeholder="cm_..."
                  value={manualKey()}
                  onInput={(e) => setManualKey(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitManualKey()}
                  class="flex-1 bg-[#0c0c0c] border border-panel-border/40 rounded px-3 py-2 font-mono text-[11px] text-text-primary placeholder:text-text-sub/40 outline-none focus:border-safe/40 transition-colors"
                />
                <button
                  type="button"
                  onClick={submitManualKey}
                  disabled={!manualKey().trim()}
                  class="px-3 py-2 bg-safe/15 border border-safe/30 rounded text-[10px] font-mono text-safe hover:bg-safe/25 disabled:opacity-40 disabled:cursor-default transition-colors"
                >
                  Use
                </button>
              </div>
            </details>
          </div>
        </Show>
      </div>
    </div>
  );
};
