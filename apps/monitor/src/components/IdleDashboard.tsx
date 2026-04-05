import { type Component, Show } from "solid-js";
import { ShieldCheck } from "./Icons";

interface IdleDashboardProps {
  connectionStatus: () => string;
  onShowSetup: () => void;
}

export const IdleDashboard: Component<IdleDashboardProps> = (props) => {
  const connected = () => props.connectionStatus() === "connected";

  return (
    <div class="flex-1 flex flex-col items-center justify-center bg-bg px-6">
      <div class="flex flex-col items-center gap-6 max-w-md text-center">
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
          {connected() ? "Connected" : "Reconnecting..."}
        </h2>

        <p class="text-sm text-text-dim">Waiting for sessions</p>

        <p class="text-xs text-text-sub leading-relaxed">
          Open Claude Code anywhere — sessions appear here automatically
        </p>

        <div class="border-t border-panel-border/30 w-full pt-5 mt-2">
          <button
            onClick={() => props.onShowSetup()}
            class="inline-flex items-center gap-2 text-[11px] text-text-sub hover:text-text-primary border border-panel-border/50 rounded px-4 py-2 transition-colors"
          >
            <ShieldCheck size={13} />
            Set up another machine
          </button>
        </div>
      </div>
    </div>
  );
};
