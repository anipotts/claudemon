// ── Canvas Store ─────────────────────────────────────────────────
// Infinite canvas state: viewport, node positions, groups, interaction.
//
// Architecture (React Flow / Xyflow pattern):
// - Outer frame uses CSS `transform: translate3d(x,y,0) scale(s)` (GPU-accelerated)
// - Nodes stay at native 1:1 resolution inside the transformed frame
// - Interactive DOM elements (buttons, inputs) just work at any zoom
//
// Positions are keyed by `canvasKey(session)` = "project_name/branch" so canvas
// layout survives across sessions, machines, and repo relocations.

import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import type { SessionState } from "../../../../packages/types/monitor";
import { canvasKey } from "./sessions";

// ── Types ──────────────────────────────────────────────────────────

export interface Point {
  x: number;
  y: number;
}

export interface Viewport {
  x: number; // pan offset in screen pixels
  y: number;
  scale: number; // zoom factor, e.g. 0.1 … 3.0
}

export interface NodePosition extends Point {}

export interface GroupState {
  id: string;
  name: string;
  projectKeys: string[]; // which canvasKey()s are in this group
  x: number;
  y: number;
  w: number;
  h: number;
  collapsed: boolean;
}

// Interaction state machine — explicit states prevent ghost drags/stuck pans.
export type Interaction =
  | { mode: "idle" }
  | { mode: "panning"; startPointer: Point; startViewport: Point }
  | { mode: "dragging"; nodeKey: string; offset: Point; startPointer: Point }
  | { mode: "selecting"; startPoint: Point; currentPoint: Point };

// Zoom tier derived from scale, used by CSS container-style attributes.
export type ZoomTier = "bird" | "medium" | "detail";

export function zoomTier(scale: number): ZoomTier {
  if (scale < 0.5) return "bird";
  if (scale > 1.5) return "detail";
  return "medium";
}

// ── Coordinate helpers ────────────────────────────────────────────

export function screenToWorld(screenX: number, screenY: number, vp: Viewport): Point {
  return {
    x: (screenX - vp.x) / vp.scale,
    y: (screenY - vp.y) / vp.scale,
  };
}

export function worldToScreen(worldX: number, worldY: number, vp: Viewport): Point {
  return {
    x: worldX * vp.scale + vp.x,
    y: worldY * vp.scale + vp.y,
  };
}

// ── Persistence ───────────────────────────────────────────────────

const POSITIONS_KEY = "claudemon_canvas_positions_v1";
const GROUPS_KEY = "claudemon_canvas_groups_v1";
const VIEWPORT_KEY = "claudemon_canvas_viewport_v1";

function loadPositions(): Record<string, NodePosition> {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadGroups(): Record<string, GroupState> {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function loadViewport(): Viewport {
  try {
    const raw = localStorage.getItem(VIEWPORT_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { x: 0, y: 0, scale: 1 };
}

// ── Store factory ─────────────────────────────────────────────────

export function createCanvasStore() {
  const [viewport, setViewport] = createStore<Viewport>(loadViewport());
  const [positions, setPositions] = createStore<Record<string, NodePosition>>(loadPositions());
  const [groups, setGroups] = createStore<Record<string, GroupState>>(loadGroups());
  const [interaction, setInteraction] = createSignal<Interaction>({ mode: "idle" });

  // ── Debounced persistence (500ms) to prevent IDB thrashing during drag ──
  let persistTimer: ReturnType<typeof setTimeout> | null = null;
  function persist() {
    if (persistTimer) clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try {
        localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
        localStorage.setItem(GROUPS_KEY, JSON.stringify(groups));
        localStorage.setItem(VIEWPORT_KEY, JSON.stringify(viewport));
      } catch {
        // storage full / unavailable — silent
      }
    }, 500);
  }

  // ── Position mutations ──────────────────────────────────────────

  function setNodePosition(key: string, pos: Point) {
    setPositions(key, pos);
    persist();
  }

  function ensurePosition(key: string, fallback: Point) {
    if (!positions[key]) {
      setPositions(key, fallback);
      persist();
    }
  }

  // ── Viewport helpers ────────────────────────────────────────────

  function setPan(x: number, y: number) {
    setViewport(
      produce((v) => {
        v.x = x;
        v.y = y;
      }),
    );
    persist();
  }

  function setScale(scale: number, pivotScreen?: Point) {
    const clamped = Math.max(0.1, Math.min(3.0, scale));

    if (pivotScreen) {
      // Keep the world point under the cursor stationary (Figma-style zoom)
      const worldPt = screenToWorld(pivotScreen.x, pivotScreen.y, viewport);
      setViewport(
        produce((v) => {
          v.scale = clamped;
          v.x = pivotScreen.x - worldPt.x * clamped;
          v.y = pivotScreen.y - worldPt.y * clamped;
        }),
      );
    } else {
      setViewport("scale", clamped);
    }
    persist();
  }

  // Snap viewport to fit all given nodes
  function fitToNodes(keys: string[], viewW: number, viewH: number, padding = 80) {
    if (keys.length === 0) return;
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const k of keys) {
      const p = positions[k];
      if (!p) continue;
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + 320); // assume node width
      maxY = Math.max(maxY, p.y + 220); // assume node height
    }
    if (!Number.isFinite(minX)) return;

    const contentW = maxX - minX;
    const contentH = maxY - minY;
    const scale = Math.min(
      (viewW - padding * 2) / contentW,
      (viewH - padding * 2) / contentH,
      1.5,
    );
    const clampedScale = Math.max(0.1, Math.min(3.0, scale));

    setViewport(
      produce((v) => {
        v.scale = clampedScale;
        v.x = padding - minX * clampedScale;
        v.y = padding - minY * clampedScale;
      }),
    );
    persist();
  }

  // ── Group mutations ─────────────────────────────────────────────

  function createGroup(name: string, projectKeys: string[]): string {
    const id = crypto.randomUUID();
    // Compute bounding box from member nodes
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    for (const k of projectKeys) {
      const p = positions[k];
      if (!p) continue;
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x + 320);
      maxY = Math.max(maxY, p.y + 220);
    }
    const group: GroupState = {
      id,
      name,
      projectKeys,
      x: Number.isFinite(minX) ? minX - 20 : 0,
      y: Number.isFinite(minY) ? minY - 40 : 0,
      w: Number.isFinite(maxX) ? maxX - minX + 40 : 400,
      h: Number.isFinite(maxY) ? maxY - minY + 60 : 300,
      collapsed: false,
    };
    setGroups(id, group);
    persist();
    return id;
  }

  function updateGroup(id: string, patch: Partial<GroupState>) {
    setGroups(id, patch);
    persist();
  }

  function deleteGroup(id: string) {
    setGroups(id, undefined!);
    persist();
  }

  // ── Public API ──────────────────────────────────────────────────

  return {
    viewport,
    setViewport,
    positions,
    setNodePosition,
    ensurePosition,
    groups,
    createGroup,
    updateGroup,
    deleteGroup,
    interaction,
    setInteraction,
    setPan,
    setScale,
    fitToNodes,
    // direct helpers
    screenToWorld: (sx: number, sy: number) => screenToWorld(sx, sy, viewport),
    worldToScreen: (wx: number, wy: number) => worldToScreen(wx, wy, viewport),
    zoomTier: () => zoomTier(viewport.scale),
    canvasKey,
  };
}
