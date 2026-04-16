import { type Component, createSignal, onMount } from "solid-js";
import { Copy, Check } from "./Icons";

interface SetupScreenProps {
  onApiKeySet: (key: string) => void;
  connectionStatus: () => string;
  apiUrl: string;
}

/**
 * ClaudeMon v0.7 onboarding — one path, no clutter.
 *
 * Old version had: GitHub sign-in link, explicit cm_ validation, fallback hints,
 * separate install command + key entry blocks. Stripped to the essentials —
 * one command, one field, live connection indicator.
 */
export const SetupScreen: Component<SetupScreenProps> = (props) => {
  const [keyInput, setKeyInput] = createSignal("");
  const [copied, setCopied] = createSignal(false);
  const connected = () => props.connectionStatus() === "connected";
  const installCmd = "/plugin install claudemon@claudemon";

  const copyCmd = () => {
    navigator.clipboard.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const submitKey = () => {
    const key = keyInput().trim();
    if (key) props.onApiKeySet(key);
  };

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

  return (
    <div
      class="flex-1 flex flex-col items-center justify-center px-8"
      style={{ background: "var(--bg)" }}
    >
      <div class="w-full max-w-md space-y-10">
        {/* Brand mark */}
        <div class="text-center space-y-2">
          <div
            class="font-mono text-[18px] font-semibold tracking-tight"
            style={{ color: "var(--suspicious)" }}
          >
            claudemon
          </div>
          <div class="text-[10px] uppercase tracking-[0.2em] text-text-sub">
            mission control · multi-session
          </div>
        </div>

        {/* Install command */}
        <div class="space-y-2">
          <div class="text-[10px] uppercase tracking-wider text-text-sub">
            Install the plugin in Claude Code
          </div>
          <button
            type="button"
            onClick={copyCmd}
            class="w-full flex items-center gap-3 bg-[#0c0c0c] border rounded px-4 py-3 font-mono text-[12px] text-left group transition-colors"
            style={{
              "border-color": copied() ? "var(--safe)" : "var(--panel-border)",
              color: "var(--safe)",
            }}
          >
            <span class="flex-1">{installCmd}</span>
            <span class="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
              {copied() ? <Check size={14} class="text-safe" /> : <Copy size={14} />}
            </span>
          </button>
          <div class="text-[9px] text-text-dim">
            Start a session with{" "}
            <code class="text-text-label">--channels plugin:claudemon@claudemon</code> to enable
            bidirectional messaging.
          </div>
        </div>

        {/* API key */}
        <div class="space-y-2">
          <div class="text-[10px] uppercase tracking-wider text-text-sub">API key</div>
          <div class="flex gap-2">
            <input
              type="text"
              placeholder="cm_..."
              value={keyInput()}
              onInput={(e) => setKeyInput(e.currentTarget.value)}
              onKeyDown={(e) => e.key === "Enter" && submitKey()}
              class="flex-1 bg-[#0c0c0c] border border-panel-border/40 rounded px-3 py-2 font-mono text-[11px] text-text-primary placeholder:text-text-sub/40 outline-none focus:border-safe/40 transition-colors"
            />
            <button
              type="button"
              onClick={submitKey}
              disabled={!keyInput().trim()}
              class="px-4 py-2 bg-safe/15 border border-safe/30 rounded text-[10px] font-mono text-safe hover:bg-safe/25 disabled:opacity-40 disabled:cursor-default transition-colors"
            >
              Connect
            </button>
          </div>
        </div>

        {/* Live status */}
        <div class="flex items-center justify-center gap-2 pt-2">
          <span
            class={`w-1.5 h-1.5 rounded-full ${connected() ? "animate-pulse" : ""}`}
            style={{
              background: connected() ? "var(--safe)" : "var(--suspicious)",
              "box-shadow": connected() ? "0 0 6px var(--safe)" : "none",
            }}
          />
          <span class="text-[10px] text-text-dim">
            {connected() ? "Listening for sessions" : "Waiting for connection"}
          </span>
        </div>
      </div>
    </div>
  );
};
