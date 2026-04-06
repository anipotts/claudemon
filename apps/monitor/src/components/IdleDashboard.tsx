import { type Component, Show, createSignal } from "solid-js";
import { Copy, Check, Terminal, Key } from "./Icons";

interface IdleDashboardProps {
  connectionStatus: () => string;
}

type Method = "plugin" | "npm";

export const IdleDashboard: Component<IdleDashboardProps> = (props) => {
  const connected = () => props.connectionStatus() === "connected";
  const apiKey = () => (typeof localStorage !== "undefined" ? localStorage.getItem("claudemon_api_key") : null);
  const [copied, setCopied] = createSignal<string | null>(null);
  const [method, setMethod] = createSignal<Method>("plugin");

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div class="flex-1 flex flex-col items-center justify-center bg-bg px-6">
      <div class="w-full max-w-sm space-y-8">
        {/* Status */}
        <div class="flex flex-col items-center gap-2">
          <span
            class={`block w-3 h-3 rounded-full ${connected() ? "bg-safe animate-pulse" : "bg-suspicious"}`}
            style={{ "box-shadow": connected() ? "0 0 10px var(--safe)" : "0 0 6px var(--suspicious)" }}
          />
          <span class="text-[11px] text-text-dim">
            {connected() ? "Listening for sessions" : "Reconnecting..."}
          </span>
        </div>

        {/* Tabs */}
        <div class="flex justify-center gap-0 border-b border-panel-border/30">
          <button
            class={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors -mb-px ${
              method() === "plugin"
                ? "text-safe border-b-2 border-safe"
                : "text-text-sub hover:text-text-primary"
            }`}
            onClick={() => setMethod("plugin")}
          >
            Plugin
          </button>
          <button
            class={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors -mb-px ${
              method() === "npm"
                ? "text-safe border-b-2 border-safe"
                : "text-text-sub hover:text-text-primary"
            }`}
            onClick={() => setMethod("npm")}
          >
            npm
          </button>
        </div>

        {/* Plugin method */}
        <Show when={method() === "plugin"}>
          <div class="space-y-4">
            <CmdBlock
              label="Add marketplace"
              cmd="/plugin marketplace add anipotts/claudemon"
              copied={copied() === "p1"}
              onCopy={() => copy("/plugin marketplace add anipotts/claudemon", "p1")}
            />
            <CmdBlock
              label="Install"
              cmd="/plugin install claudemon@anipotts"
              highlight
              copied={copied() === "p2"}
              onCopy={() => copy("/plugin install claudemon@anipotts", "p2")}
            />
            <p class="text-[9px] text-text-sub text-center">
              You'll be prompted for your API key. Hooks auto-register on install.
            </p>
          </div>
        </Show>

        {/* npm method */}
        <Show when={method() === "npm"}>
          <div class="space-y-4">
            <CmdBlock
              label="Install"
              cmd="npm install -g claudemon-cli"
              copied={copied() === "n1"}
              onCopy={() => copy("npm install -g claudemon-cli", "n1")}
            />
            <CmdBlock
              label="Connect"
              cmd={apiKey() ? `claudemon-cli init --key ${apiKey()}` : "claudemon-cli init"}
              highlight
              copied={copied() === "n2"}
              onCopy={() => copy(apiKey() ? `claudemon-cli init --key ${apiKey()}` : "claudemon-cli init", "n2")}
            />
            <p class="text-[9px] text-text-sub text-center">
              Writes hooks to ~/.claude/settings.json. Uninstall: claudemon-cli uninstall
            </p>
          </div>
        </Show>

        {/* API key */}
        <Show when={apiKey()}>
          <div class="flex items-center gap-2 border border-panel-border/20 rounded px-3 py-2">
            <Key size={10} class="text-text-sub shrink-0" />
            <span class="text-[9px] text-text-sub shrink-0">Your key</span>
            <span class="text-[9px] font-mono text-text-dim flex-1 truncate">{apiKey()}</span>
            <button class="shrink-0" onClick={() => copy(apiKey()!, "key")}>
              {copied() === "key" ? <Check size={10} class="text-safe" /> : <Copy size={10} class="text-text-sub hover:text-text-primary transition-colors" />}
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
};

function CmdBlock(props: { label: string; cmd: string; highlight?: boolean; copied: boolean; onCopy: () => void }) {
  return (
    <div>
      <div class="text-[9px] text-text-sub uppercase tracking-wider mb-1.5">{props.label}</div>
      <button
        class={`w-full flex items-center gap-2 bg-[#0c0c0c] border rounded px-3 py-2.5 font-mono text-[11px] text-left group transition-colors ${
          props.highlight
            ? "border-safe/30 text-safe hover:border-safe/50"
            : "border-panel-border/40 text-text-primary hover:border-panel-border"
        }`}
        onClick={props.onCopy}
      >
        <Terminal size={11} class={props.highlight ? "text-safe/50 shrink-0" : "text-text-sub shrink-0"} />
        <span class="flex-1 truncate">{props.cmd}</span>
        <span class="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
          {props.copied ? <Check size={11} class="text-safe" /> : <Copy size={11} />}
        </span>
      </button>
    </div>
  );
}
