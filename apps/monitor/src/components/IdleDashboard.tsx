import { type Component, Show, createSignal } from "solid-js";
import { Copy, Check, Terminal, Key } from "./Icons";

interface IdleDashboardProps {
  connectionStatus: () => string;
}

type Method = "plugin" | "npm";

export const IdleDashboard: Component<IdleDashboardProps> = (props) => {
  const connected = () => props.connectionStatus() === "connected";
  const apiKey = () => (typeof localStorage !== "undefined" ? localStorage.getItem("claudemon_api_key") : null);
  const [copiedStep, setCopiedStep] = createSignal<number | null>(null);
  const [method, setMethod] = createSignal<Method>("plugin");

  const copyCmd = (text: string, step: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(step);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const CopyIcon = (p: { step: number }) => (
    <span class="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
      {copiedStep() === p.step ? <Check size={12} class="text-safe" /> : <Copy size={12} />}
    </span>
  );

  return (
    <div class="flex-1 flex flex-col items-center justify-center bg-bg px-6">
      <div class="w-full max-w-md space-y-6">
        {/* Status */}
        <div class="flex flex-col items-center gap-3">
          <span
            class={`block w-4 h-4 rounded-full ${connected() ? "bg-safe animate-pulse" : "bg-suspicious"}`}
            style={{ "box-shadow": connected() ? "0 0 12px var(--safe)" : "0 0 8px var(--suspicious)" }}
          />
          <h2 class="text-lg font-bold text-text-primary tracking-wide">
            {connected() ? "Ready" : "Reconnecting..."}
          </h2>
        </div>

        {/* API key inline */}
        <Show when={apiKey()}>
          <div class="flex items-center gap-2 bg-[#0c0c0c] border border-panel-border/30 rounded px-3 py-2">
            <Key size={11} class="text-text-sub shrink-0" />
            <span class="text-[10px] text-text-sub shrink-0">API Key</span>
            <span class="text-[10px] font-mono text-text-dim flex-1 truncate">{apiKey()}</span>
            <button class="text-text-sub hover:text-text-primary transition-colors shrink-0" onClick={() => copyCmd(apiKey()!, 0)}>
              {copiedStep() === 0 ? <Check size={11} class="text-safe" /> : <Copy size={11} />}
            </button>
          </div>
        </Show>

        {/* Method tabs */}
        <div class="flex items-center gap-1 border-b border-panel-border/30 pb-0">
          <button
            class={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-t transition-colors ${method() === "plugin" ? "bg-safe/10 text-safe border-b-2 border-safe" : "text-text-sub hover:text-text-primary"}`}
            onClick={() => setMethod("plugin")}
          >
            Plugin
          </button>
          <button
            class={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-t transition-colors ${method() === "npm" ? "bg-safe/10 text-safe border-b-2 border-safe" : "text-text-sub hover:text-text-primary"}`}
            onClick={() => setMethod("npm")}
          >
            npm
          </button>
        </div>

        {/* Commands */}
        <Show when={method() === "plugin"}>
          <div class="space-y-3">
            <div class="text-[9px] text-text-sub uppercase tracking-wider">Step 1 — Add marketplace</div>
            <button
              class="w-full flex items-center gap-2 bg-[#0c0c0c] border border-panel-border/40 rounded px-3 py-2.5 font-mono text-[11px] text-text-primary hover:border-panel-border transition-colors text-left group"
              onClick={() => copyCmd("/plugin marketplace add https://github.com/anipotts/claudemon", 1)}
            >
              <Terminal size={12} class="text-text-sub shrink-0" />
              <span class="flex-1">/plugin marketplace add https://github.com/anipotts/claudemon</span>
              <CopyIcon step={1} />
            </button>

            <div class="text-[9px] text-text-sub uppercase tracking-wider">Step 2 — Install</div>
            <button
              class="w-full flex items-center gap-2 bg-[#0c0c0c] border border-safe/30 rounded px-3 py-2.5 font-mono text-[11px] text-safe hover:border-safe/50 transition-colors text-left group"
              onClick={() => copyCmd("/plugin install claudemon@anipotts", 2)}
            >
              <Terminal size={12} class="text-safe/60 shrink-0" />
              <span class="flex-1">/plugin install claudemon@anipotts</span>
              <CopyIcon step={2} />
            </button>

            <p class="text-[9px] text-text-sub">
              Enter your API key when prompted. Hooks auto-register. Uninstall: /plugin uninstall claudemon
            </p>
          </div>
        </Show>

        <Show when={method() === "npm"}>
          <div class="space-y-3">
            <div class="text-[9px] text-text-sub uppercase tracking-wider">Step 1 — Install CLI</div>
            <button
              class="w-full flex items-center gap-2 bg-[#0c0c0c] border border-panel-border/40 rounded px-3 py-2.5 font-mono text-[11px] text-text-primary hover:border-panel-border transition-colors text-left group"
              onClick={() => copyCmd("npm install -g claudemon-cli", 3)}
            >
              <Terminal size={12} class="text-text-sub shrink-0" />
              <span class="flex-1">npm install -g claudemon-cli</span>
              <CopyIcon step={3} />
            </button>

            <div class="text-[9px] text-text-sub uppercase tracking-wider">Step 2 — Connect</div>
            <button
              class="w-full flex items-center gap-2 bg-[#0c0c0c] border border-safe/30 rounded px-3 py-2.5 font-mono text-[11px] text-safe hover:border-safe/50 transition-colors text-left group"
              onClick={() => copyCmd(apiKey() ? `claudemon-cli init --key ${apiKey()}` : "claudemon-cli init", 4)}
            >
              <Terminal size={12} class="text-safe/60 shrink-0" />
              <span class="flex-1 truncate">{apiKey() ? `claudemon-cli init --key ${apiKey()}` : "claudemon-cli init"}</span>
              <CopyIcon step={4} />
            </button>

            <p class="text-[9px] text-text-sub">
              Writes hooks to ~/.claude/settings.json. Uninstall: claudemon-cli uninstall
            </p>
          </div>
        </Show>

        <p class="text-[10px] text-text-dim text-center">
          Open a new Claude Code session after setup — it appears here automatically.
        </p>
      </div>
    </div>
  );
};
