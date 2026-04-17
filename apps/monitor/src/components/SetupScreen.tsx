import { type Component, For, Show, createEffect, createMemo, createSignal, onMount } from "solid-js";
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
 * ClaudeMon onboarding — intentionally familiar to any Claude Code user.
 *
 * Claude Code users in 2026 recognize:
 *   - `/plugin marketplace add <owner>/<repo>` then `/plugin install <plugin>@<marketplace>`
 *   - GitHub OAuth (no email collection)
 *   - Paste-on-prompt API key flows
 *   - Monospace terminal blocks with `$` prompt prefixes
 *   - Anthropic's warm-neutral palette
 *
 * We lean into all of those. Three auto-progressing states:
 *   1. welcome  — single "Continue with GitHub" CTA, trust language below
 *   2. minting  — signed in, auto-generating a key (brief spinner)
 *   3. ready    — copy-paste install block with key masked, one-click reveal
 */
export const SetupScreen: Component<SetupScreenProps> = (props) => {
  const [apiKey, setApiKey] = createSignal<string | null>(null);
  const [minting, setMinting] = createSignal(false);
  const [mintError, setMintError] = createSignal<string | null>(null);
  const [manualKey, setManualKey] = createSignal("");
  const [revealed, setRevealed] = createSignal(false);
  const [copied, setCopied] = createSignal<string | null>(null);

  const connected = () => props.connectionStatus() === "connected";
  const marketplaceCmd = "/plugin marketplace add anipotts/claudemon";
  const installCmd = "/plugin install claudemon@anipotts";

  const allCmds = () =>
    `${marketplaceCmd}\n${installCmd}\n\n# Paste when Claude Code prompts for an API key:\n${apiKey() || ""}`;

  const maskedKey = createMemo(() => {
    const k = apiKey();
    if (!k) return "";
    if (revealed()) return k;
    return `${k.slice(0, 4)}${"·".repeat(Math.max(8, k.length - 7))}${k.slice(-3)}`;
  });

  // Auto-capture ?key= URL param
  onMount(() => {
    const url = new URL(window.location.href);
    const key = url.searchParams.get("key");
    if (key) {
      url.searchParams.delete("key");
      window.history.replaceState({}, "", url.toString());
      props.onApiKeySet(key);
    }
  });

  // Fire auto-mint when the user is signed in AND has no keys AND we don't already have one
  createEffect(() => {
    if (props.user && !props.user.has_api_keys && !apiKey() && !minting() && !mintError()) {
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

  function submitManualKey() {
    const k = manualKey().trim();
    if (k) props.onApiKeySet(k);
  }

  return (
    <div
      class="flex-1 flex flex-col items-center justify-center px-6 overflow-y-auto"
      style={{ background: "var(--bg)" }}
    >
      <div class="w-full max-w-[520px] py-10 space-y-8">
        {/* ── Brand ──────────────────────────────────────────────── */}
        <div class="text-center space-y-1.5">
          <h1
            class="text-[28px] font-semibold tracking-tight"
            style={{ "font-family": "var(--heading-font)", color: "var(--text-primary)" }}
          >
            Claude<span style={{ color: "var(--coral)" }}>Mon</span>
          </h1>
          <div class="text-[11px] tracking-wider text-text-dim">the lightweight monitor for Claude Code</div>
        </div>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* STATE 1 — WELCOME (signed out)                           */}
        {/* ═══════════════════════════════════════════════════════ */}
        <Show when={!props.authLoading && !props.user}>
          <div class="space-y-5">
            <a href={signInUrl()} class="block group">
              <div
                class="flex items-center justify-center gap-3 px-5 py-3.5 rounded-md border font-mono text-[13px] transition-all cursor-pointer"
                style={{
                  background: "#141210",
                  "border-color": "var(--panel-border)",
                  color: "var(--text-primary)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--suspicious)";
                  e.currentTarget.style.background = "rgba(201, 169, 110, 0.06)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--panel-border)";
                  e.currentTarget.style.background = "#141210";
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.24c-3.33.72-4.03-1.41-4.03-1.41-.55-1.38-1.34-1.75-1.34-1.75-1.09-.75.08-.73.08-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.17 0 0 1.01-.32 3.3 1.23a11.47 11.47 0 016 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.65.25 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.22.7.83.58A12.01 12.01 0 0024 12.5C24 5.87 18.63.5 12 .5z" />
                </svg>
                Continue with GitHub
              </div>
            </a>

            <div class="space-y-2 text-center">
              <p class="text-[11px] text-text-label leading-relaxed">
                Sign in once — we'll generate an API key and show you a copy-paste install block.
              </p>
              <p class="text-[10px] text-text-sub leading-relaxed">
                Read your public GitHub profile only. No email, no repo access.
              </p>
            </div>

            {/* Trust matrix */}
            <div class="grid grid-cols-3 gap-2 pt-2">
              <For
                each={[
                  { label: "no conversation data", sub: "tool calls only" },
                  { label: "ephemeral relay", sub: "no server DB" },
                  { label: "encrypted at rest", sub: "device-bound AES-256" },
                ]}
              >
                {(item) => (
                  <div
                    class="px-2 py-2 rounded border text-center"
                    style={{ background: "#141210", "border-color": "var(--panel-border)" }}
                  >
                    <div class="text-[9px] text-safe uppercase tracking-wider font-medium">{item.label}</div>
                    <div class="text-[9px] text-text-sub mt-0.5">{item.sub}</div>
                  </div>
                )}
              </For>
            </div>

            {/* Advanced disclosure — paste existing key */}
            <details class="pt-3">
              <summary class="text-[10px] text-text-sub hover:text-text-label cursor-pointer list-none select-none text-center transition-colors">
                ⌥ I already have an API key
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
                  class="px-4 py-2 bg-safe/15 border border-safe/30 rounded text-[10px] font-mono text-safe hover:bg-safe/25 disabled:opacity-40 disabled:cursor-default transition-colors"
                >
                  Use key
                </button>
              </div>
            </details>
          </div>
        </Show>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* STATE 2 — MINTING KEY (auth loading / POST in flight)    */}
        {/* ═══════════════════════════════════════════════════════ */}
        <Show when={props.authLoading || (props.user && minting() && !apiKey())}>
          <div class="flex flex-col items-center gap-4 py-6">
            <Show when={props.user}>
              <div class="flex items-center gap-2.5">
                <img
                  src={props.user!.avatar_url}
                  alt=""
                  class="w-7 h-7 rounded-full"
                  style={{ border: "1px solid var(--panel-border)" }}
                />
                <span class="text-[12px] text-text-primary font-mono">@{props.user!.login}</span>
              </div>
            </Show>
            <div class="flex items-center gap-2">
              <span
                class="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: "var(--suspicious)", "box-shadow": "0 0 6px var(--suspicious)" }}
              />
              <span class="text-[11px] text-text-label">{minting() ? "generating api key" : "signing you in"}</span>
            </div>
          </div>
        </Show>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* STATE 3 — READY (key in hand)                            */}
        {/* ═══════════════════════════════════════════════════════ */}
        <Show when={props.user && apiKey() && !minting()}>
          <div class="space-y-5">
            {/* Identity strip */}
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-2.5">
                <img
                  src={props.user!.avatar_url}
                  alt=""
                  class="w-6 h-6 rounded-full"
                  style={{ border: "1px solid var(--panel-border)" }}
                />
                <span class="text-[11px] text-text-label font-mono">@{props.user!.login}</span>
              </div>
              <a
                href={`${props.apiUrl}/auth/logout`}
                class="text-[9px] text-text-sub hover:text-attack transition-colors uppercase tracking-wider"
              >
                Sign out
              </a>
            </div>

            {/* ── Install block — looks like a terminal session ── */}
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <div class="text-[10px] uppercase tracking-wider text-text-sub">Run in Claude Code</div>
                <button
                  type="button"
                  onClick={() => copy(allCmds(), "all")}
                  class="flex items-center gap-1.5 px-2 py-1 rounded text-[10px] border transition-colors"
                  style={{
                    color: copied() === "all" ? "var(--safe)" : "var(--text-label)",
                    "border-color": copied() === "all" ? "rgba(163, 177, 138, 0.4)" : "var(--panel-border)",
                    background: copied() === "all" ? "rgba(163, 177, 138, 0.1)" : "transparent",
                  }}
                >
                  {copied() === "all" ? (
                    <>
                      <Check size={11} /> Copied all 3
                    </>
                  ) : (
                    <>
                      <Copy size={11} /> Copy all 3 steps
                    </>
                  )}
                </button>
              </div>

              <div
                class="rounded-md border overflow-hidden"
                style={{ "border-color": "var(--panel-border)", background: "#0a0a0a" }}
              >
                {/* Step 1: marketplace add */}
                <div
                  class="px-3 py-2.5 flex items-start gap-2 font-mono text-[11px]"
                  style={{ "border-bottom": "1px solid rgba(61, 58, 52, 0.5)" }}
                >
                  <span class="text-text-sub shrink-0 select-none w-4">1</span>
                  <span class="shrink-0 select-none" style={{ color: "var(--suspicious)" }}>
                    $
                  </span>
                  <span class="flex-1 break-all" style={{ color: "var(--text-primary)" }}>
                    {marketplaceCmd}
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(marketplaceCmd, "market")}
                    class="shrink-0 text-text-sub hover:text-safe transition-colors"
                    title="Copy this line"
                  >
                    {copied() === "market" ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                </div>

                {/* Step 2: install */}
                <div
                  class="px-3 py-2.5 flex items-start gap-2 font-mono text-[11px]"
                  style={{ "border-bottom": "1px solid rgba(61, 58, 52, 0.5)" }}
                >
                  <span class="text-text-sub shrink-0 select-none w-4">2</span>
                  <span class="shrink-0 select-none" style={{ color: "var(--suspicious)" }}>
                    $
                  </span>
                  <span class="flex-1 break-all" style={{ color: "var(--text-primary)" }}>
                    {installCmd}
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(installCmd, "install")}
                    class="shrink-0 text-text-sub hover:text-safe transition-colors"
                    title="Copy this line"
                  >
                    {copied() === "install" ? <Check size={11} /> : <Copy size={11} />}
                  </button>
                </div>

                {/* Step 3: API key (masked by default, click to reveal) */}
                <div class="px-3 py-2.5 space-y-1.5">
                  <div class="flex items-center gap-2 text-[9px] text-text-sub uppercase tracking-wider">
                    <span class="w-4 inline-block">3</span>
                    <span>
                      Paste this when Claude Code prompts for <code class="text-text-label">api_key</code>
                    </span>
                  </div>
                  <div
                    class="flex items-center gap-2 px-2.5 py-1.5 rounded font-mono text-[11px]"
                    style={{ background: "rgba(201, 169, 110, 0.08)", border: "1px solid rgba(201, 169, 110, 0.25)" }}
                  >
                    <span class="shrink-0 select-none" style={{ color: "var(--suspicious)" }}>
                      ›
                    </span>
                    <span
                      class="flex-1 break-all select-all"
                      style={{ color: "var(--suspicious)", "font-feature-settings": "'tnum'" }}
                    >
                      {maskedKey()}
                    </span>
                    <button
                      type="button"
                      onClick={() => setRevealed((v) => !v)}
                      class="shrink-0 text-[9px] text-text-sub hover:text-text-label uppercase tracking-wider transition-colors"
                    >
                      {revealed() ? "hide" : "show"}
                    </button>
                    <button
                      type="button"
                      onClick={() => copy(apiKey()!, "key")}
                      class="shrink-0 text-text-sub hover:text-safe transition-colors"
                      title="Copy key"
                    >
                      {copied() === "key" ? <Check size={11} /> : <Copy size={11} />}
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex items-center justify-between text-[9px] text-text-sub pt-0.5">
                <button
                  type="button"
                  onClick={() => void mintKey("regenerated")}
                  class="hover:text-text-label transition-colors uppercase tracking-wider"
                >
                  regenerate
                </button>
                <span>
                  Optional: add <code class="text-text-label">--channels plugin:claudemon@anipotts</code> to message
                  sessions
                </span>
              </div>
            </div>

            {/* Live listener status */}
            <div
              class="flex items-center justify-center gap-2 px-4 py-2.5 rounded-md border transition-colors"
              style={{
                background: connected() ? "rgba(163, 177, 138, 0.05)" : "rgba(138, 132, 120, 0.05)",
                "border-color": connected() ? "rgba(163, 177, 138, 0.3)" : "var(--panel-border)",
              }}
            >
              <span
                class="w-1.5 h-1.5 rounded-full"
                classList={{ "animate-pulse": connected() }}
                style={{
                  background: connected() ? "var(--safe)" : "var(--text-sub)",
                  "box-shadow": connected() ? "0 0 6px var(--safe)" : "none",
                }}
              />
              <span class="text-[11px]" style={{ color: connected() ? "var(--safe)" : "var(--text-label)" }}>
                {connected() ? "Listening — start a session and it appears here" : "Connecting to relay..."}
              </span>
            </div>
          </div>
        </Show>

        {/* ═══════════════════════════════════════════════════════ */}
        {/* STATE 3.5 — SIGNED IN, HAS OLD KEYS, NONE MINTED YET     */}
        {/* ═══════════════════════════════════════════════════════ */}
        <Show when={props.user && props.user!.has_api_keys && !apiKey() && !minting() && !mintError()}>
          <div class="space-y-4 text-center">
            <div class="flex items-center justify-center gap-2.5">
              <img
                src={props.user!.avatar_url}
                alt=""
                class="w-7 h-7 rounded-full"
                style={{ border: "1px solid var(--panel-border)" }}
              />
              <span class="text-[12px] text-text-label font-mono">Welcome back, @{props.user!.login}</span>
            </div>
            <div class="text-[11px] text-text-dim leading-relaxed max-w-sm mx-auto">
              You already have keys on another device. Generate a fresh one here — old keys stay valid.
            </div>
            <button
              type="button"
              onClick={() => void mintKey("new-device")}
              class="px-5 py-2.5 rounded-md border font-mono text-[12px] transition-colors"
              style={{
                background: "rgba(201, 169, 110, 0.1)",
                "border-color": "rgba(201, 169, 110, 0.4)",
                color: "var(--suspicious)",
              }}
            >
              Generate a new API key
            </button>
            <details class="pt-1">
              <summary class="text-[10px] text-text-sub hover:text-text-label cursor-pointer list-none text-center transition-colors">
                ⌥ Or paste an existing key
              </summary>
              <div class="mt-3 flex gap-2 max-w-xs mx-auto">
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

        {/* ═══════════════════════════════════════════════════════ */}
        {/* STATE ERROR — mint failed                                */}
        {/* ═══════════════════════════════════════════════════════ */}
        <Show when={props.user && mintError() && !apiKey()}>
          <div class="space-y-3 text-center">
            <div class="text-[11px] text-attack">Could not generate your API key.</div>
            <div class="text-[10px] text-text-dim">{mintError()}</div>
            <button
              type="button"
              onClick={() => void mintKey("retry")}
              class="px-4 py-2 bg-safe/15 border border-safe/30 rounded text-[11px] font-mono text-safe hover:bg-safe/25 transition-colors"
            >
              Try again
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
};
