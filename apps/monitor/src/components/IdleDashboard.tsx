import { type Component, Show, createSignal } from "solid-js";
import { Copy, Check, Terminal, Key } from "./Icons";

interface IdleDashboardProps {
  connectionStatus: () => string;
}

export const IdleDashboard: Component<IdleDashboardProps> = (props) => {
  const connected = () => props.connectionStatus() === "connected";
  const apiKey = () => (typeof localStorage !== "undefined" ? localStorage.getItem("claudemon_api_key") : null);
  const [copiedStep, setCopiedStep] = createSignal<number | null>(null);

  const copyCmd = (text: string, step: number) => {
    navigator.clipboard.writeText(text);
    setCopiedStep(step);
    setTimeout(() => setCopiedStep(null), 2000);
  };

  const initCmd = () => {
    const key = apiKey();
    return key ? `claudemon-cli init --key ${key}` : "claudemon-cli init";
  };

  const CmdRow = (p: { step: number; text: string; highlight?: boolean }) => (
    <div class="flex items-center gap-3">
      <span class="text-[10px] font-bold text-text-sub w-4 shrink-0 text-right">{p.step}</span>
      <button
        class={`flex-1 flex items-center gap-2 bg-[#0c0c0c] border rounded px-3 py-2 font-mono text-[11px] hover:brightness-110 transition-all text-left group ${
          p.highlight ? "border-safe/30 text-safe" : "border-panel-border/40 text-text-primary"
        }`}
        onClick={() => copyCmd(p.text, p.step)}
      >
        <Terminal size={12} class={p.highlight ? "text-safe/60" : "text-text-sub"} />
        <span class="flex-1 truncate">{p.text}</span>
        <span class="shrink-0 opacity-50 group-hover:opacity-100 transition-opacity">
          {copiedStep() === p.step ? <Check size={12} class="text-safe" /> : <Copy size={12} />}
        </span>
      </button>
    </div>
  );

  return (
    <div class="flex-1 flex flex-col items-center justify-center bg-bg px-6">
      <div class="flex flex-col items-center gap-5 max-w-xl w-full">
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

        {/* API Key — show inline so user can copy without going to settings */}
        <Show when={apiKey()}>
          <div class="flex items-center gap-2 bg-[#0c0c0c] border border-panel-border/30 rounded px-3 py-1.5 w-full max-w-sm">
            <Key size={11} class="text-text-sub shrink-0" />
            <span class="text-[10px] text-text-sub">API Key</span>
            <span class="text-[10px] font-mono text-text-dim flex-1 truncate">{apiKey()!.slice(0, 12)}...</span>
            <button
              class="text-text-sub hover:text-text-primary transition-colors"
              onClick={() => copyCmd(apiKey()!, 0)}
            >
              {copiedStep() === 0 ? <Check size={11} class="text-safe" /> : <Copy size={11} />}
            </button>
          </div>
        </Show>

        {/* Two install methods side by side */}
        <div class="w-full grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          {/* Plugin method */}
          <div class="space-y-2.5">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold text-safe uppercase tracking-[2px]">Plugin</span>
              <span class="text-[9px] text-safe/60 bg-safe/10 px-1.5 py-0.5 rounded-sm">recommended</span>
            </div>
            <CmdRow step={1} text="/plugin marketplace add https://github.com/anipotts/claudemon" />
            <CmdRow step={2} text="/plugin install claudemon@claudemon-hub" highlight />
            <p class="text-[9px] text-text-sub pl-7">
              Enter API key when prompted. Auto-registers hooks, auto-cleans on uninstall.
            </p>
          </div>

          {/* npm method */}
          <div class="space-y-2.5">
            <div class="flex items-center gap-2">
              <span class="text-[10px] font-bold text-text-label uppercase tracking-[2px]">npm CLI</span>
              <span class="text-[9px] text-text-sub/60 bg-panel-border/20 px-1.5 py-0.5 rounded-sm">alternative</span>
            </div>
            <CmdRow step={1} text="npm install -g claudemon-cli" />
            <CmdRow step={2} text={initCmd()} highlight />
            <p class="text-[9px] text-text-sub pl-7">
              Writes hooks to ~/.claude/settings.json. Uninstall with claudemon-cli uninstall.
            </p>
          </div>
        </div>

        <p class="text-[10px] text-text-dim mt-1">
          Open a new Claude Code session after setup — it appears here automatically.
        </p>
      </div>
    </div>
  );
};
