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

  const saveKeyCmd = () => {
    const key = apiKey();
    return key
      ? `mkdir -p ~/.claudemon && echo "${key}" > ~/.claudemon/api-key`
      : 'mkdir -p ~/.claudemon && echo "YOUR_KEY" > ~/.claudemon/api-key';
  };

  return (
    <div class="flex-1 flex flex-col items-center justify-center bg-bg px-6">
      <div class="w-full max-w-sm space-y-7">
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
              method() === "plugin" ? "text-safe border-b-2 border-safe" : "text-text-sub hover:text-text-primary"
            }`}
            onClick={() => setMethod("plugin")}
          >
            Plugin
          </button>
          <button
            class={`px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors -mb-px ${
              method() === "npm" ? "text-safe border-b-2 border-safe" : "text-text-sub hover:text-text-primary"
            }`}
            onClick={() => setMethod("npm")}
          >
            npm
          </button>
        </div>

        {/* Plugin method */}
        <Show when={method() === "plugin"}>
          <div class="space-y-4">
            <CmdBlock label="Save your API key" cmd={saveKeyCmd()} id="p0" copied={copied()} onCopy={copy} />
            <CmdBlock label="Add marketplace" cmd="/plugin marketplace add anipotts/claudemon" id="p1" copied={copied()} onCopy={copy} />
            <CmdBlock label="Install" cmd="/plugin install claudemon@anipotts" id="p2" copied={copied()} onCopy={copy} highlight />
            <p class="text-[9px] text-text-sub text-center">
              Run steps 2-3 inside Claude Code. Then start a new session.
            </p>
          </div>
        </Show>

        {/* npm method */}
        <Show when={method() === "npm"}>
          <div class="space-y-4">
            <CmdBlock label="Install CLI" cmd="npm install -g claudemon-cli" id="n1" copied={copied()} onCopy={copy} />
            <CmdBlock
              label="Connect"
              cmd={apiKey() ? `claudemon-cli init --key ${apiKey()}` : "claudemon-cli init"}
              id="n2"
              copied={copied()}
              onCopy={copy}
              highlight
            />
            <p class="text-[9px] text-text-sub text-center">
              Then start a new Claude Code session.
            </p>
          </div>
        </Show>

        {/* API key display */}
        <Show when={apiKey()}>
          <div class="flex items-center gap-2 border border-panel-border/20 rounded px-3 py-2">
            <Key size={10} class="text-text-sub shrink-0" />
            <span class="text-[9px] text-text-sub shrink-0">Your key</span>
            <span class="text-[9px] font-mono text-text-dim flex-1 truncate">{apiKey()}</span>
            <button class="shrink-0" onClick={() => copy(apiKey()!, "key")}>
              {copied() === "key" ? (
                <Check size={10} class="text-safe" />
              ) : (
                <Copy size={10} class="text-text-sub hover:text-text-primary transition-colors" />
              )}
            </button>
          </div>
        </Show>
      </div>
    </div>
  );
};

function CmdBlock(props: {
  label: string;
  cmd: string;
  id: string;
  highlight?: boolean;
  copied: string | null;
  onCopy: (text: string, id: string) => void;
}) {
  return (
    <div>
      <div class="text-[9px] text-text-sub uppercase tracking-wider mb-1.5">{props.label}</div>
      <button
        class={`w-full flex items-center gap-2 bg-[#0c0c0c] border rounded px-3 py-2.5 font-mono text-[11px] text-left group transition-colors ${
          props.highlight
            ? "border-safe/30 text-safe hover:border-safe/50"
            : "border-panel-border/40 text-text-primary hover:border-panel-border"
        }`}
        onClick={() => props.onCopy(props.cmd, props.id)}
      >
        <Terminal size={11} class={props.highlight ? "text-safe/50 shrink-0" : "text-text-sub shrink-0"} />
        <span class="flex-1 truncate">{props.cmd}</span>
        <span class="shrink-0 opacity-40 group-hover:opacity-100 transition-opacity">
          {props.copied === props.id ? <Check size={11} class="text-safe" /> : <Copy size={11} />}
        </span>
      </button>
    </div>
  );
}
