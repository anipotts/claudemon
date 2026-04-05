import { type Component, createSignal, createEffect, onCleanup, Show } from "solid-js";
import {
  ShieldCheck,
  Copy,
  Check,
  Terminal,
  ArrowRight,
  Circle,
  GitBranch,
  Desktop,
  Lightning,
  TreeStructure,
  Eye,
} from "./Icons";

// ── Copy button ─────────────────────────────────────────────────────

function CopyBlock(props: { text: string; label?: string }) {
  const [copied, setCopied] = createSignal(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(props.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div class="group relative">
      <Show when={props.label}>
        <div class="text-[9px] text-text-sub uppercase tracking-wider mb-1">{props.label}</div>
      </Show>
      <button
        onClick={handleCopy}
        class="w-full text-left bg-[#0e0d0c] border border-panel-border/60 rounded-sm px-3 py-2.5 text-[12px] text-text-primary leading-5 hover:border-text-dim/40 transition-all cursor-pointer"
      >
        <pre class="whitespace-pre-wrap break-all overflow-hidden">{props.text}</pre>
        <span class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {copied() ? (
            <Check size={14} class="text-safe" />
          ) : (
            <Copy size={14} class="text-text-sub" />
          )}
        </span>
      </button>
    </div>
  );
}

// ── Animated pulse ring ─────────────────────────────────────────────

function PulseRing() {
  return (
    <div class="relative w-20 h-20 flex items-center justify-center">
      <div class="absolute inset-0 rounded-full border border-safe/20 animate-[ping_3s_ease-out_infinite]" />
      <div class="absolute inset-2 rounded-full border border-safe/30 animate-[ping_3s_ease-out_0.5s_infinite]" />
      <div class="absolute inset-4 rounded-full border border-safe/40 animate-[ping_3s_ease-out_1s_infinite]" />
      <ShieldCheck size={32} class="text-safe relative z-10" />
    </div>
  );
}

// ── Fake agent map preview ──────────────────────────────────────────

function MapPreview() {
  const [step, setStep] = createSignal(0);

  const interval = setInterval(() => {
    setStep((s) => (s + 1) % 4);
  }, 2000);
  onCleanup(() => clearInterval(interval));

  const agents = [
    { type: "claude-code", branch: "main", action: "editing src/index.ts", color: "#a3b18a" },
    { type: "cursor", branch: "feat/auth", action: "reading api/routes.ts", color: "#c9a96e" },
    { type: "codex", branch: "main", action: "running tests", color: "#7ea8be" },
  ];

  return (
    <div class="border border-panel-border/40 rounded-sm bg-card/50 p-3 text-[11px]">
      <div class="flex items-center gap-2 mb-2 text-text-sub">
        <Desktop size={12} />
        <span class="font-bold text-text-label">your-machine</span>
        <span class="text-[9px] uppercase tracking-wider">local</span>
      </div>
      <div class="ml-3 border-l border-panel-border/30 pl-3 space-y-1.5">
        {agents.map((agent, i) => (
          <div
            class="flex items-center gap-2 transition-all duration-500"
            style={{ opacity: i <= step() ? 1 : 0.2 }}
          >
            <span
              class={`w-1.5 h-1.5 rounded-full shrink-0 ${i <= step() ? "animate-pulse" : ""}`}
              style={{
                background: i <= step() ? agent.color : "#3d3a34",
                "box-shadow": i <= step() ? `0 0 4px ${agent.color}` : "none",
              }}
            />
            <GitBranch size={10} class="text-text-sub" />
            <span class="text-text-sub">{agent.branch}</span>
            <span class="font-bold" style={{ color: agent.color }}>
              {agent.type}
            </span>
            <span class="text-text-sub truncate">{agent.action}</span>
          </div>
        ))}
        <Show when={step() >= 3}>
          <div class="flex items-center gap-1.5 mt-1 step-in">
            <Lightning size={10} class="text-attack" />
            <span class="text-[10px] text-attack">Conflict: src/index.ts</span>
          </div>
        </Show>
      </div>
    </div>
  );
}

// ── Step indicator ──────────────────────────────────────────────────

function StepDots(props: { current: number; total: number }) {
  return (
    <div class="flex items-center gap-1.5">
      {Array.from({ length: props.total }, (_, i) => (
        <div
          class={`h-1 rounded-full transition-all duration-300 ${
            i === props.current ? "w-6 bg-safe" : i < props.current ? "w-1.5 bg-safe/50" : "w-1.5 bg-panel-border"
          }`}
        />
      ))}
    </div>
  );
}

// ── Main onboarding ─────────────────────────────────────────────────

export const Onboarding: Component<{ apiUrl: string }> = (props) => {
  const [step, setStep] = createSignal(0);
  const [checking, setChecking] = createSignal(false);

  const settingsSnippet = () => `// ~/.claude/settings.json
{
  "hooks": {
    "PreToolUse": [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash ~/.claudemon-hook.sh", "async": true }] }],
    "PostToolUse": [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash ~/.claudemon-hook.sh", "async": true }] }],
    "Notification": [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash ~/.claudemon-hook.sh", "async": true }] }],
    "Stop": [{ "matcher": "", "hooks": [{ "type": "command", "command": "bash ~/.claudemon-hook.sh", "async": true }] }]
  }
}`;

  return (
    <div class="flex-1 flex items-center justify-center overflow-y-auto">
      <div class="max-w-xl w-full px-6 py-12">
        {/* Hero */}
        <Show when={step() === 0}>
          <div class="step-in flex flex-col items-center text-center gap-6">
            <PulseRing />

            <div>
              <h1 class="text-2xl font-bold tracking-wide mb-2">ClaudeMon</h1>
              <p class="text-[13px] text-text-dim leading-5 max-w-md">
                See every AI agent working on your codebase. Across machines, branches, and worktrees &mdash; in real time.
              </p>
            </div>

            <MapPreview />

            {/* Value props */}
            <div class="grid grid-cols-3 gap-4 w-full text-center">
              <div class="flex flex-col items-center gap-1.5">
                <TreeStructure size={18} class="text-safe" />
                <span class="text-[10px] text-text-label">Agent Map</span>
                <span class="text-[9px] text-text-sub leading-3">See who is working where</span>
              </div>
              <div class="flex flex-col items-center gap-1.5">
                <Eye size={18} class="text-suspicious" />
                <span class="text-[10px] text-text-label">Live Activity</span>
                <span class="text-[9px] text-text-sub leading-3">Every read, edit, and commit</span>
              </div>
              <div class="flex flex-col items-center gap-1.5">
                <Lightning size={18} class="text-attack" />
                <span class="text-[10px] text-text-label">Conflict Detection</span>
                <span class="text-[9px] text-text-sub leading-3">Before merge nightmares</span>
              </div>
            </div>

            <button
              onClick={() => setStep(1)}
              class="flex items-center gap-2 bg-safe/15 border border-safe/30 rounded-sm px-6 py-2.5 text-[11px] font-bold text-safe hover:bg-safe/25 transition-colors uppercase tracking-wider"
            >
              Connect Claude Code <ArrowRight size={13} />
            </button>

            <StepDots current={0} total={3} />
          </div>
        </Show>

        {/* Step 1: Download hook */}
        <Show when={step() === 1}>
          <div class="step-in flex flex-col gap-5">
            <div class="flex items-center gap-3">
              <button onClick={() => setStep(0)} class="text-text-sub hover:text-text-primary transition-colors text-[11px]">&larr;</button>
              <div>
                <h2 class="text-lg font-bold">Install the hook</h2>
                <p class="text-[12px] text-text-dim">One script, zero dependencies</p>
              </div>
            </div>

            <div class="space-y-4">
              <div>
                <div class="flex items-center gap-2 mb-2">
                  <span class="w-5 h-5 rounded-full bg-safe/20 text-safe flex items-center justify-center text-[10px] font-bold">1</span>
                  <span class="text-[11px] text-text-label">Download the hook script</span>
                </div>
                <CopyBlock text={`curl -fsSL ${props.apiUrl}/hook.sh -o ~/.claudemon-hook.sh && chmod +x ~/.claudemon-hook.sh`} />
              </div>

              <div>
                <div class="flex items-center gap-2 mb-2">
                  <span class="w-5 h-5 rounded-full bg-safe/20 text-safe flex items-center justify-center text-[10px] font-bold">2</span>
                  <span class="text-[11px] text-text-label">Add to Claude Code settings</span>
                </div>
                <CopyBlock label="~/.claude/settings.json" text={settingsSnippet()} />
              </div>

              <div class="bg-panel/50 rounded-sm p-3 border border-panel-border/40">
                <div class="flex items-center gap-2 mb-1.5">
                  <Terminal size={13} class="text-text-dim" />
                  <span class="text-[10px] text-text-label uppercase tracking-wider">How it works</span>
                </div>
                <p class="text-[11px] text-text-dim leading-4">
                  The hook runs on every Claude Code tool call. It auto-detects your machine, repo, branch, and worktree — then fires a heartbeat + event to the ClaudeMon API. Non-blocking, under 50ms overhead.
                </p>
              </div>
            </div>

            <div class="flex items-center gap-3 mt-2">
              <button
                onClick={() => setStep(2)}
                class="flex items-center gap-2 bg-safe/15 border border-safe/30 rounded-sm px-5 py-2 text-[11px] font-bold text-safe hover:bg-safe/25 transition-colors uppercase tracking-wider"
              >
                Next: Verify <ArrowRight size={13} />
              </button>
              <StepDots current={1} total={3} />
            </div>
          </div>
        </Show>

        {/* Step 2: Verify connection */}
        <Show when={step() === 2}>
          <div class="step-in flex flex-col gap-5">
            <div class="flex items-center gap-3">
              <button onClick={() => setStep(1)} class="text-text-sub hover:text-text-primary transition-colors text-[11px]">&larr;</button>
              <div>
                <h2 class="text-lg font-bold">Verify connection</h2>
                <p class="text-[12px] text-text-dim">Start a Claude Code session &mdash; it should appear here automatically</p>
              </div>
            </div>

            <div class="space-y-4">
              <div class="text-[12px] text-text-label">
                Open any project with Claude Code. The hook will start reporting immediately.
              </div>

              <div class="border border-panel-border rounded-sm p-4 bg-card/50">
                <div class="flex items-center justify-center gap-3 mb-4">
                  <div class="relative">
                    <Circle
                      size={40}
                      class={checking() ? "text-suspicious animate-spin" : "text-panel-border"}
                    />
                    <ShieldCheck
                      size={18}
                      class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-text-dim"
                    />
                  </div>
                </div>

                <div class="text-center mb-4">
                  <div class="text-[12px] text-text-dim">
                    {checking() ? "Listening for agents..." : "Waiting for first heartbeat"}
                  </div>
                  <div class="text-[10px] text-text-sub mt-1">
                    This page auto-refreshes via WebSocket
                  </div>
                </div>

                <button
                  onClick={() => setChecking(true)}
                  class="w-full bg-panel border border-panel-border rounded-sm px-4 py-2 text-[11px] text-text-dim hover:text-text-primary hover:border-text-dim transition-colors"
                >
                  {checking() ? "Checking..." : "Check now"}
                </button>
              </div>

              <details class="group">
                <summary class="text-[11px] text-text-sub cursor-pointer hover:text-text-primary transition-colors">
                  Want to test manually?
                </summary>
                <div class="mt-2">
                  <CopyBlock
                    label="Run in any terminal"
                    text={`curl -s -X POST ${props.apiUrl}/events \\\n  -H "Content-Type: application/json" \\\n  -d '{"session_id":"manual-test","machine_id":"test","project_path":"/tmp/test","hook_event_name":"SessionStart","timestamp":'$(date +%s)000'}'`}
                  />
                </div>
              </details>
            </div>

            <div class="flex items-center gap-3 mt-2">
              <StepDots current={2} total={3} />
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};
