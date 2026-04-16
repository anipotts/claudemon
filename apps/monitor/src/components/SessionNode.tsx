import { type Component, Show, createSignal } from "solid-js";
import type { PendingAction, SessionState } from "../../../../packages/types/monitor";
import { SessionBadge } from "./SessionBadge";
import { ModelBadge } from "./ModelBadge";

/**
 * SessionNode — one component, all zoom levels.
 *
 * Uses CSS container queries to progressively disclose information based on
 * the node's rendered width. Zoom (CSS transform on the outer canvas frame)
 * doesn't change the node's logical width — it scales the whole frame — so
 * zoom level is communicated via a `data-zoom-tier` attribute on the parent
 * canvas for optional density adjustments.
 *
 * See globals.css for the @container rules that show/hide sections.
 */

interface SessionNodeProps {
  session: SessionState;
  pendingAction?: PendingAction;
  onActionRespond?: (actionId: string, hookResponse: Record<string, unknown>) => void;
  onSendMessage?: (sessionId: string, content: string) => void;
  onOpen?: (sessionId: string) => void;
  selected?: boolean;
}

export const SessionNode: Component<SessionNodeProps> = (props) => {
  const [input, setInput] = createSignal("");
  const s = () => props.session;

  function send() {
    const text = input().trim();
    if (!text || !props.onSendMessage) return;
    props.onSendMessage(s().session_id, text);
    setInput("");
  }

  function approve() {
    if (!props.pendingAction || !props.onActionRespond) return;
    const name = props.pendingAction.hook_event_name;
    const hookResponse =
      name === "PermissionRequest"
        ? { hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "allow" } } }
        : name === "Elicitation"
          ? { hookSpecificOutput: { hookEventName: "Elicitation", action: "accept" } }
          : {};
    props.onActionRespond(props.pendingAction.id, hookResponse);
  }

  function deny() {
    if (!props.pendingAction || !props.onActionRespond) return;
    const name = props.pendingAction.hook_event_name;
    const hookResponse =
      name === "PermissionRequest"
        ? { hookSpecificOutput: { hookEventName: "PermissionRequest", decision: { behavior: "deny" } } }
        : name === "Elicitation"
          ? { hookSpecificOutput: { hookEventName: "Elicitation", action: "decline" } }
          : {};
    props.onActionRespond(props.pendingAction.id, hookResponse);
  }

  const statusColor = () => {
    const st = s().status;
    if (st === "working" || st === "thinking") return "var(--safe)";
    if (st === "waiting" || st === "error") return "var(--suspicious)";
    if (st === "done") return "var(--text-label)";
    return "var(--text-sub)";
  };

  return (
    <div
      class="session-node"
      data-node-key={`${s().project_name}/${s().branch || "main"}`}
      data-status={s().status}
      data-selected={props.selected ? "true" : "false"}
      onDblClick={() => props.onOpen?.(s().session_id)}
    >
      {/* Status dot — always present; visible at bird zoom via container query */}
      <div
        class="node-dot"
        style={{
          background: statusColor(),
          "box-shadow": s().status === "working" ? `0 0 8px ${statusColor()}` : "none",
        }}
      />

      {/* Header — name, model, branch */}
      <div class="node-header">
        <span class="node-name" title={s().session_id}>
          {s().project_name}
        </span>
        <Show when={s().model}>
          <ModelBadge model={s().model!} />
        </Show>
        <Show when={s().channel_connected}>
          <span class="node-channel-dot" title="Channel connected" />
        </Show>
      </div>

      {/* Meta — branch, session id fragment */}
      <div class="node-meta">
        <Show when={s().branch}>
          <span class="node-branch">{s().branch}</span>
        </Show>
        <SessionBadge sessionId={s().session_id} projectName={s().project_name} size="sm" />
      </div>

      {/* Current activity */}
      <div class="node-activity" title={s().smart_status || ""}>
        {s().smart_status || "idle"}
      </div>

      {/* Last prompt */}
      <Show when={s().last_prompt}>
        <div class="node-prompt" title={s().last_prompt}>
          <span class="node-prompt-label">›</span> {s().last_prompt}
        </div>
      </Show>

      {/* Pending permission — approve/deny inline */}
      <Show when={props.pendingAction}>
        <div class="node-permission">
          <div class="node-permission-label">
            🔒 {props.pendingAction!.hook_event_name}
          </div>
          <div class="node-permission-buttons">
            <button type="button" onClick={approve} class="node-btn-allow">
              Allow
            </button>
            <button type="button" onClick={deny} class="node-btn-deny">
              Deny
            </button>
          </div>
        </div>
      </Show>

      {/* Message input — always available when channel is connected */}
      <Show
        when={s().channel_connected !== false && props.onSendMessage}
        fallback={
          <Show when={props.onSendMessage}>
            <div class="node-input-disabled" title="Start session with --channels plugin:claudemon@claudemon">
              channel offline
            </div>
          </Show>
        }
      >
        <div class="node-input">
          <input
            type="text"
            placeholder="Message..."
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            onPointerDown={(e) => e.stopPropagation()} // don't start node drag
            onDblClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={send}
            disabled={!input().trim()}
            onPointerDown={(e) => e.stopPropagation()}
            class="node-send"
          >
            ➤
          </button>
        </div>
      </Show>
    </div>
  );
};
