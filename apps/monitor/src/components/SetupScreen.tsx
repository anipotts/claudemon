import { type Component, Show, createSignal, onMount } from "solid-js";
import { Copy, Check, ArrowRight } from "./Icons";
import { ClaudeMonIcon } from "./ClaudeMonIcon";

interface SetupScreenProps {
  onApiKeySet: (key: string) => void;
  connectionStatus: () => string;
  apiUrl: string;
}

export const SetupScreen: Component<SetupScreenProps> = (props) => {
  const [keyInput, setKeyInput] = createSignal("");
  const [copied, setCopied] = createSignal(false);
  const [keyError, setKeyError] = createSignal(false);
  const connected = () => props.connectionStatus() === "connected";

  const installCmd = "/install claudemon";

  const copyCmd = () => {
    navigator.clipboard.writeText(installCmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const submitKey = () => {
    const key = keyInput().trim();
    if (!key.startsWith("cm_") || key.length < 10) {
      setKeyError(true);
      setTimeout(() => setKeyError(false), 2000);
      return;
    }
    props.onApiKeySet(key);
  };

  // Auto-capture ?key= URL param
  onMount(() => {
    const url = new URL(window.location.href);
    const key = url.searchParams.get("key");
    if (key?.startsWith("cm_")) {
      url.searchParams.delete("key");
      window.history.replaceState({}, "", url.toString());
      props.onApiKeySet(key);
    }
  });

  return (
    <div class="flex-1 flex flex-col items-center justify-center bg-bg px-6 overflow-hidden">
      <div class="w-full max-w-sm space-y-6 text-center">
        {/* Mascot */}
        <div class="flex justify-center">
          <ClaudeMonIcon pose={connected() ? "sleep" : "watching"} size={64} class="opacity-50" />
        </div>

        {/* Plugin install — golden path */}
        <div>
          <div class="text-[10px] text-text-sub uppercase tracking-wider mb-1.5">In Claude Code on your computer, run:</div>
          <button
            onClick={copyCmd}
            class="w-full flex items-center gap-2 bg-[#0c0c0c] border border-safe/30 rounded px-3 py-2.5 font-mono text-[12px] text-safe text-left group hover:border-safe/50 transition-colors"
          >
            <span class="flex-1">{installCmd}</span>
            <span class="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
              {copied() ? <Check size={12} class="text-safe" /> : <Copy size={12} />}
            </span>
          </button>
          <p class="text-[9px] text-text-dim mt-1.5 text-center">That's it. Start a new session and it appears here.</p>
        </div>

        {/* API key paste — fallback */}
        <div>
          <div class="text-[9px] text-text-sub text-center mb-1.5">or paste your API key</div>
          <div class="flex gap-1.5">
            <input
              type="text"
              placeholder="cm_..."
              value={keyInput()}
              onInput={(e) => { setKeyInput(e.currentTarget.value); setKeyError(false); }}
              onKeyDown={(e) => e.key === "Enter" && submitKey()}
              class={`flex-1 bg-[#0c0c0c] border rounded px-3 py-2 font-mono text-[11px] text-text-primary placeholder:text-text-sub/40 outline-none transition-colors ${
                keyError() ? "border-attack/50" : "border-panel-border/40 focus:border-panel-border"
              }`}
            />
            <button
              onClick={submitKey}
              class="px-3 py-2 bg-panel/30 border border-panel-border/40 rounded text-text-sub hover:text-text-primary hover:border-panel-border transition-colors"
            >
              <ArrowRight size={12} />
            </button>
          </div>
          <Show when={keyError()}>
            <p class="text-[9px] text-attack mt-1">Key must start with cm_ and be at least 10 characters</p>
          </Show>
        </div>

        {/* Connection status */}
        <div class="flex items-center justify-center gap-2">
          <span
            class={`w-2 h-2 rounded-full ${connected() ? "bg-safe animate-pulse" : "bg-suspicious"}`}
            style={{ "box-shadow": connected() ? "0 0 8px var(--safe)" : "0 0 4px var(--suspicious)" }}
          />
          <span class="text-[10px] text-text-dim">
            {connected() ? "Listening for sessions..." : "Connecting..."}
          </span>
        </div>

        {/* GitHub sign-in — optional, non-blocking */}
        <div class="text-center pt-2">
          <a
            href={`${props.apiUrl}/auth/login?redirect=${encodeURIComponent(window.location.href)}`}
            class="text-[9px] text-text-sub hover:text-text-dim transition-colors"
          >
            Sign in with GitHub for key management
          </a>
        </div>
      </div>
    </div>
  );
};
