# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is ClaudeMon

Real-time Claude Code session monitor at claudemon.com. Users install hooks via `claudemon-cli` npm package, which sends events to `api.claudemon.com`. The frontend at `app.claudemon.com` shows live sessions via WebSocket. A plugin scaffold exists at `plugin/` for future distribution as a Claude Code plugin (eliminates manual hook setup).

## Architecture

```
apps/
├── monitor/        ← SolidJS + Vite + Tailwind v4 frontend (Cloudflare Pages)
├── monitor-api/    ← Hono Worker + Durable Objects WebSocket relay (Cloudflare Workers)
└── desktop/        ← Tauri v2 scaffold (not yet built)
packages/
├── cli/            ← Zero-dep Node.js CLI published as claudemon-cli on npm
└── types/          ← Shared TypeScript types (single source of truth)
plugin/             ← Claude Code plugin scaffold (not yet published)
├── plugin.json     ← Manifest with userConfig for secure API key storage
├── hooks/          ← hooks.json + send-event.sh (async batched sender)
└── commands/       ← /claudemon:status slash command
```

## Dev Commands

```bash
cd apps/monitor && npm run dev       # Frontend (Vite)
cd apps/monitor-api && npm run dev   # API Worker (wrangler)
npx vitest run                       # Tests (121 tests, API + events)
npx tsc --noEmit                     # Typecheck
npx @biomejs/biome check --write .   # Lint + format
```

## Deploy

```bash
cd apps/monitor-api && wrangler deploy                                    # API
cd apps/monitor && npm run build && wrangler pages deploy dist --project-name=claudemon  # Frontend
cd packages/cli && npm publish --access public                            # CLI to npm
```

## URLs

| URL                     | What                                  |
| ----------------------- | ------------------------------------- |
| `app.claudemon.com`     | Production frontend                   |
| `staging.claudemon.com` | Staging frontend                      |
| `api.claudemon.com`     | Worker API + WebSocket                |
| `claudemon.com`         | Landing page (served from API worker) |

## Key Decisions

- SolidJS over React for fine-grained reactivity (WebSocket events update individual DOM nodes)
- Durable Objects with Hibernation API for WebSocket persistence
- DO storage for session state persistence
- tool_use_id deduplication merges PreToolUse + PostToolUse into single events, computes `duration_ms`
- Ghost session prevention: hook rejects missing session_id, DO rejects unknown-\* prefixes, auto-stale after 10min
- Privacy-first: no persistent database, ephemeral WebSocket relay only
- `packages/types/monitor.ts` is the single source of truth for hook events and type definitions — never duplicate the `HOOK_EVENTS` array
- CLI (`claudemon-cli`) is zero-dependency by design — only Node.js built-ins
- CLI v0.6.0 uses async command hooks (not HTTP) — fixes Claude Code silently blocking HTTP hooks for SessionStart/Setup events
- Hooks register 12 core events (not all 27) to reduce noise while capturing full lifecycle

## Hook System (Critical Knowledge)

Claude Code has 27 hook events but **HTTP hooks are silently blocked for SessionStart and Setup** (see `src/utils/hooks.ts:1850-1864` in CC source). The CLI and plugin use `type: "command"` with `async: true` for all events to be non-blocking and work on all event types.

The 12 core events monitored: SessionStart, SessionEnd, Setup, PreToolUse, PostToolUse, Stop, StopFailure, SubagentStart, SubagentStop, UserPromptSubmit, Notification, PostCompact.

## Conventions

- Dark theme: `#0a0a0a` bg, earthy palette (safe: `#a3b18a`, suspicious: `#c9a96e`, attack: `#b85c4a`, blocked: `#8a3a2e`)
- All hex colors must be full 6-char (e.g., `#666666` not `#666`) — shorthand breaks the `+ "25"` alpha concatenation pattern used in inline styles
- Monospace font throughout (Geist Mono)
- Tailwind v4 with CSS custom properties
- No emojis in UI — use Phosphor icons exclusively (imported from `./Icons` wrapper)
- Extremely granular, descriptive git commits
- Never use `git add .` or `git add -A` — always add specific files by name
- Shared components go in `apps/monitor/src/components/` (ModelBadge, PermissionBadge, SessionBadge, FileBadge)
- Permission mode colors match Claude Code source (`src/utils/permissions/PermissionMode.ts`)
- Model badge colors: opus=#c9a96e (gold), sonnet=#7b9fbf (blue), haiku=#8a8478 (gray)

## Layout Architecture

Fixed 3-zone layout — sidebars never move:

```
[Sessions 280px] [Center flex-1] [Activity 280px]
```

- Left sidebar: sessions/projects list, always visible, scroll-y
- Right sidebar: cross-session activity feed, always visible, scroll-y
- Center: tabs (one visible at a time) or columns (horizontal scroll, each column scroll-y independently)
- Clicking a session always opens/activates it — never toggles closed (close via X only)

## Branding

- Name: "ClaudeMon" (capital C, capital M)
- Tagline: "Monitor your Claude Code sessions in real time"
- npm package: `claudemon-cli` (`claudemon` is taken by an unrelated project)
- Author: Ani Potts / Ani Potts LLC

## Dependency Graph

```
packages/types/monitor.ts (SINGLE SOURCE OF TRUTH)
├── apps/monitor/src/stores/sessions.ts     → websocket.ts
├── apps/monitor/src/components/SessionDetail.tsx
│   ├── PermissionBadge.tsx, ModelBadge.tsx, FileBadge.tsx
│   ├── SessionBadge.tsx, Timestamp.tsx, Markdown.tsx, Icons.tsx
│   └── ../utils/time.ts
├── apps/monitor/src/components/ActivityTimeline.tsx
├── apps/monitor/src/components/AgentMap.tsx
├── apps/monitor/src/App.tsx (orchestrator)
├── apps/monitor-api/src/session-room.ts
└── packages/cli/bin/claudemon.js (ZERO DEPS, duplicates HOOK_EVENTS)
```

No circular dependencies. Clean DAG.
