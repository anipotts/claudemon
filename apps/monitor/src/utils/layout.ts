// ── Auto-layout for canvas nodes ─────────────────────────────────
// Grid-based placement with project clustering. Deterministic, predictable.
// Users override by dragging — their positions always win.

import type { SessionState } from "../../../../packages/types/monitor";
import type { NodePosition, Point } from "../stores/canvas";
import { canvasKey } from "../stores/sessions";

export const NODE_W = 320;
export const NODE_H = 220;
export const GAP = 60;

/**
 * Given a set of sessions and their existing (user-dragged) positions, return
 * placements for every session. Existing positions are preserved unchanged.
 *
 * New sessions are placed using a project-clustered grid layout:
 *   - Sessions sharing a canvasKey (same project_name/branch) stack vertically
 *   - Distinct projects occupy distinct columns, ordered by first-seen timestamp
 *   - Subagents place directly below their parent session
 */
export function autoLayout(
  sessions: Record<string, SessionState>,
  existing: Record<string, NodePosition>,
): Record<string, NodePosition> {
  const positions: Record<string, NodePosition> = { ...existing };

  // Group sessions by canvasKey (project_name/branch)
  const byKey = new Map<string, SessionState[]>();
  for (const s of Object.values(sessions)) {
    if (s.status === "offline") continue;
    const key = canvasKey(s);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(s);
  }

  // Within each group, sort by started_at so older sessions get the top slot
  for (const group of byKey.values()) {
    group.sort((a, b) => a.started_at - b.started_at);
  }

  // Determine next open column by scanning existing positions
  let maxX = 0;
  for (const pos of Object.values(existing)) {
    if (pos.x > maxX) maxX = pos.x;
  }
  let nextCol = Object.keys(existing).length === 0 ? 0 : maxX + NODE_W + GAP;

  // Place each group that doesn't have a position yet
  const groups = Array.from(byKey.entries()).sort(
    (a, b) => (a[1][0]?.started_at || 0) - (b[1][0]?.started_at || 0),
  );
  for (const [key, members] of groups) {
    const basePos = positions[key];
    if (basePos) continue; // user-placed already, skip

    positions[key] = { x: nextCol, y: 0 };
    nextCol += NODE_W + GAP;
  }

  return positions;
}

/**
 * Resolve the on-canvas position for a specific session, accounting for siblings
 * in the same project stacking vertically below the canvasKey anchor.
 */
export function resolveSessionPosition(
  session: SessionState,
  allSessions: Record<string, SessionState>,
  positions: Record<string, NodePosition>,
): Point {
  const key = canvasKey(session);
  const base = positions[key] || { x: 0, y: 0 };

  // Find siblings sharing the same canvasKey, sorted by started_at.
  // This session's index among siblings determines the vertical offset.
  const siblings = Object.values(allSessions)
    .filter((s) => canvasKey(s) === key)
    .sort((a, b) => a.started_at - b.started_at);
  const idx = siblings.findIndex((s) => s.session_id === session.session_id);

  return {
    x: base.x,
    y: base.y + (idx < 0 ? 0 : idx) * (NODE_H + 20),
  };
}
