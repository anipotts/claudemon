import { type Component, Show, createSignal } from "solid-js";
import { ShieldCheck, Copy, Check, Terminal } from "./Icons";

interface IdleDashboardProps {
  connectionStatus: () => string;
  onShowSetup: () => void;
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

  return (
    <div class="flex-1 flex flex-col items-center justify-center bg-bg px-6">
      <div class="flex flex-col items-center gap-6 max-w-lg text-center">
        {/* Pulsing status dot */}
        <div class="relative">
          <Show
            when={connected()}
            fallback={
              <span
                class="block w-5 h-5 rounded-full bg-suspicious"
                style={{ "box-shadow": "0 0 12px var(--suspicious)" }}
              />
            }
          >
            <span
              class="block w-5 h-5 rounded-full bg-safe animate-pulse"
              style={{ "box-shadow": "0 0 16px var(--safe)" }}
            />
          </Show>
        </div>

        <h2 class="text-xl font-bold text-text-primary tracking-wide">
          {connected() ? "Ready" : "Reconnecting..."}
        </h2>

        <p class="text-[11px] text-text-dim">
          Set up monitoring in two commands. Sessions appear here in real time.
        </p>

        {/* Setup instructions */}
        <div class="w-full text-left space-y-3 mt-2">
          <div class="text-[10px] text-text-label uppercase tracking-[2px] mb-2">Quick Setup</div>

          {/* Step 1 */}
          <div class="flex items-center gap-3">
            <span class="text-[10px] font-bold text-text-sub w-4 shrink-0">1</span>
            <button
              class="flex-1 flex items-center gap-2 bg-[#0c0c0c] border border-panel-border/40 rounded px-3 py-2 font-mono text-[11px] text-text-primary hover:border-panel-border transition-colors text-left group"
              onClick={() => copyCmd("npm install -g claudemon-cli", 1)}
            >
              <Terminal size={12} class="text-text-sub shrink-0" />
              <span class="flex-1">npm install -g claudemon-cli</span>
              <span class="text-text-sub group-hover:text-text-primary shrink-0">
                {copiedStep() === 1 ? <Check size={12} class="text-safe" /> : <Copy size={12} />}
              </span>
            </button>
          </div>

          {/* Step 2 */}
          <div class="flex items-center gap-3">
            <span class="text-[10px] font-bold text-text-sub w-4 shrink-0">2</span>
            <button
              class="flex-1 flex items-center gap-2 bg-[#0c0c0c] border border-safe/30 rounded px-3 py-2 font-mono text-[11px] text-safe hover:border-safe/50 transition-colors text-left group"
              onClick={() => copyCmd(initCmd(), 2)}
            >
              <Terminal size={12} class="text-safe/60 shrink-0" />
              <span class="flex-1 truncate">{initCmd()}</span>
              <span class="text-safe/60 group-hover:text-safe shrink-0">
                {copiedStep() === 2 ? <Check size={12} class="text-safe" /> : <Copy size={12} />}
              </span>
            </button>
          </div>

          <p class="text-[9px] text-text-sub pl-7">
            Registers all 27 Claude Code hook events. Safe to re-run.
          </p>
        </div>

        <p class="text-[9px] text-text-sub mt-2">
          Then open a new Claude Code session — it appears here automatically.
        </p>

        <div class="border-t border-panel-border/30 w-full pt-4 mt-1">
          <button
            onClick={() => props.onShowSetup()}
            class="inline-flex items-center gap-2 text-[10px] text-text-sub hover:text-text-primary border border-panel-border/50 rounded px-4 py-2 transition-colors"
          >
            <ShieldCheck size={12} />
            Advanced setup options
          </button>
        </div>
      </div>
    </div>
  );
};
