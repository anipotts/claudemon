import { type Component, For, Show, createEffect, createMemo, onCleanup, onMount } from "solid-js";
import type { PendingAction, SessionState } from "../../../../packages/types/monitor";
import { createCanvasStore, zoomTier } from "../stores/canvas";
import { canvasKey } from "../stores/sessions";
import { SessionNode } from "./SessionNode";
import { autoLayout, NODE_H, NODE_W } from "../utils/layout";

/**
 * Canvas — spatial workspace for multi-session monitoring.
 *
 * React Flow / Xyflow pattern:
 * - Outer frame uses `transform: translate3d(x,y,0) scale(s)` (GPU-accelerated)
 * - Session nodes are absolutely-positioned DOM elements at 1:1 resolution
 * - Interactive elements (buttons, inputs) work at any zoom
 *
 * Pointer event state machine handles pan/drag/select without ghost drags.
 * Wheel zoom is cursor-anchored (Figma-style).
 */

interface CanvasProps {
  sessions: Record<string, SessionState>;
  pendingActions?: Record<string, PendingAction>;
  onActionRespond?: (actionId: string, hookResponse: Record<string, unknown>) => void;
  onSendMessage?: (sessionId: string, content: string) => void;
  onOpenSession?: (sessionId: string) => void;
  selectedIds?: string[];
}

export const Canvas: Component<CanvasProps> = (props) => {
  const canvas = createCanvasStore();
  let rootRef: HTMLDivElement | undefined;

  // Auto-layout new sessions as they arrive
  createEffect(() => {
    const ids = Object.keys(props.sessions);
    if (ids.length === 0) return;
    const updated = autoLayout(props.sessions, canvas.positions);
    for (const [key, pos] of Object.entries(updated)) {
      canvas.ensurePosition(key, pos);
    }
  });

  // Track the on-canvas position for each session — resolves sibling stacking
  const sessionPositions = createMemo(() => {
    const out: Record<string, { sessionId: string; x: number; y: number }> = {};
    const byKey = new Map<string, SessionState[]>();
    for (const s of Object.values(props.sessions)) {
      const k = canvasKey(s);
      if (!byKey.has(k)) byKey.set(k, []);
      byKey.get(k)!.push(s);
    }
    for (const [key, members] of byKey) {
      const base = canvas.positions[key];
      if (!base) continue;
      const sorted = [...members].sort((a, b) => a.started_at - b.started_at);
      sorted.forEach((s, i) => {
        out[s.session_id] = {
          sessionId: s.session_id,
          x: base.x,
          y: base.y + i * (NODE_H + 20),
        };
      });
    }
    return out;
  });

  // ── Pointer event state machine ────────────────────────────────

  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return; // left-click only
    const target = e.target as HTMLElement;

    // Ignore pointer-down on interactive node elements (buttons/inputs)
    if (target.closest("input, button, textarea, a, select")) return;

    const nodeEl = target.closest("[data-node-key]") as HTMLElement | null;

    if (nodeEl) {
      // Start dragging this node (dragging by the canvasKey anchor)
      const key = nodeEl.dataset.nodeKey!;
      const pos = canvas.positions[key] || { x: 0, y: 0 };
      const worldPt = canvas.screenToWorld(e.clientX, e.clientY);
      canvas.setInteraction({
        mode: "dragging",
        nodeKey: key,
        offset: { x: worldPt.x - pos.x, y: worldPt.y - pos.y },
        startPointer: { x: e.clientX, y: e.clientY },
      });
    } else {
      // Pan the canvas
      canvas.setInteraction({
        mode: "panning",
        startPointer: { x: e.clientX, y: e.clientY },
        startViewport: { x: canvas.viewport.x, y: canvas.viewport.y },
      });
    }
    rootRef?.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: PointerEvent) {
    const state = canvas.interaction();
    if (state.mode === "panning") {
      canvas.setPan(
        state.startViewport.x + (e.clientX - state.startPointer.x),
        state.startViewport.y + (e.clientY - state.startPointer.y),
      );
    } else if (state.mode === "dragging") {
      const worldPt = canvas.screenToWorld(e.clientX, e.clientY);
      canvas.setNodePosition(state.nodeKey, {
        x: worldPt.x - state.offset.x,
        y: worldPt.y - state.offset.y,
      });
    }
  }

  function onPointerUp(e: PointerEvent) {
    canvas.setInteraction({ mode: "idle" });
    rootRef?.releasePointerCapture(e.pointerId);
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    // Trackpad pinch comes through as ctrl+wheel on macOS; both map to zoom.
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const newScale = canvas.viewport.scale * factor;
    canvas.setScale(newScale, { x: e.clientX, y: e.clientY });
  }

  // ── Keyboard shortcuts ──────────────────────────────────────────

  function onKeyDown(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === "f" || e.key === "F") {
      const rect = rootRef?.getBoundingClientRect();
      if (rect) {
        canvas.fitToNodes(Object.keys(canvas.positions), rect.width, rect.height);
      }
    } else if (e.key === "0") {
      // Reset zoom to 1:1, centered
      const rect = rootRef?.getBoundingClientRect();
      if (rect) {
        canvas.setViewport({ x: 0, y: 0, scale: 1 });
      }
    } else if (e.key === "+" || e.key === "=") {
      canvas.setScale(canvas.viewport.scale * 1.15);
    } else if (e.key === "-" || e.key === "_") {
      canvas.setScale(canvas.viewport.scale * 0.87);
    }
  }

  onMount(() => {
    window.addEventListener("keydown", onKeyDown);
  });
  onCleanup(() => {
    window.removeEventListener("keydown", onKeyDown);
  });

  const tier = createMemo(() => zoomTier(canvas.viewport.scale));

  return (
    <div
      ref={rootRef}
      class="canvas-root"
      data-zoom-tier={tier()}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onWheel={onWheel}
      style={{
        position: "relative",
        flex: "1 1 0",
        overflow: "hidden",
        "touch-action": "none",
        "background-color": "var(--bg)",
        "background-image": "radial-gradient(circle at 1px 1px, var(--panel-border) 0.5px, transparent 0)",
        "background-size": `${24 * canvas.viewport.scale}px ${24 * canvas.viewport.scale}px`,
        "background-position": `${canvas.viewport.x}px ${canvas.viewport.y}px`,
        cursor: canvas.interaction().mode === "panning" ? "grabbing" : "grab",
      }}
    >
      <div
        class="canvas-world"
        style={{
          position: "absolute",
          inset: 0,
          transform: `translate3d(${canvas.viewport.x}px, ${canvas.viewport.y}px, 0) scale(${canvas.viewport.scale})`,
          "transform-origin": "0 0",
          "will-change": "transform",
        }}
      >
        <For each={Object.values(props.sessions)}>
          {(session) => {
            const pos = createMemo(() => sessionPositions()[session.session_id]);
            const selected = createMemo(() => props.selectedIds?.includes(session.session_id) || false);
            return (
              <Show when={pos()}>
                <div
                  style={{
                    position: "absolute",
                    left: `${pos()!.x}px`,
                    top: `${pos()!.y}px`,
                    width: `${NODE_W}px`,
                    height: `${NODE_H}px`,
                    contain: "layout style",
                    transform: "translateZ(0)",
                  }}
                >
                  <SessionNode
                    session={session}
                    pendingAction={findPendingAction(session.session_id, props.pendingActions)}
                    onActionRespond={props.onActionRespond}
                    onSendMessage={props.onSendMessage}
                    onOpen={props.onOpenSession}
                    selected={selected()}
                  />
                </div>
              </Show>
            );
          }}
        </For>
      </div>

      {/* Zoom indicator */}
      <div
        style={{
          position: "absolute",
          bottom: "12px",
          right: "12px",
          padding: "4px 8px",
          "font-family": "inherit",
          "font-size": "10px",
          color: "var(--text-label)",
          background: "var(--panel)",
          border: "1px solid var(--panel-border)",
          "border-radius": "3px",
          "pointer-events": "none",
        }}
      >
        {Math.round(canvas.viewport.scale * 100)}% · {tier()}
      </div>
    </div>
  );
};

function findPendingAction(
  sessionId: string,
  pending: Record<string, PendingAction> | undefined,
): PendingAction | undefined {
  if (!pending) return undefined;
  for (const action of Object.values(pending)) {
    if (action?.session_id === sessionId) return action;
  }
  return undefined;
}
