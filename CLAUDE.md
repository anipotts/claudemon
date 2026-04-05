# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is ClaudeMon

Real-time Claude Code session monitor at claudemon.com. Users install hooks via `claudemon-cli` npm package, which sends all 27 hook events to `api.claudemon.com`. The frontend at `app.claudemon.com` shows live sessions via WebSocket.

## Architecture

```
apps/
├── monitor/        ← SolidJS + Vite + Tailwind v4 frontend (Cloudflare Pages)
├── monitor-api/    ← Hono Worker + Durable Objects WebSocket relay (Cloudflare Workers)
└── desktop/        ← Tauri v2 scaffold (not yet built)
packages/
├── cli/            ← Zero-dep Node.js CLI published as claudemon-cli on npm
└── types/          ← Shared TypeScript types (single source of truth)
```

## Dev Commands

```bash
cd apps/monitor && npm run dev       # Frontend (Vite)
cd apps/monitor-api && npm run dev   # API Worker (wrangler)
```

## Deploy

```bash
cd apps/monitor-api && wrangler deploy              # API
cd apps/monitor && npm run build && wrangler deploy  # Frontend
cd packages/cli && npm publish --access public       # CLI to npm
```

## URLs

| URL | What |
|-----|------|
| `app.claudemon.com` | Production frontend |
| `staging.claudemon.com` | Staging frontend |
| `api.claudemon.com` | Worker API + WebSocket |
| `claudemon.com` | Landing page (needs building) |

## Key Decisions

- SolidJS over React for fine-grained reactivity (WebSocket events update individual DOM nodes)
- Durable Objects with Hibernation API for WebSocket persistence
- DO storage for session state persistence
- tool_use_id deduplication merges PreToolUse + PostToolUse into single events
- Ghost session prevention: hook rejects missing session_id, DO rejects unknown-* prefixes, auto-stale after 10min
- Privacy-first: no persistent database, ephemeral WebSocket relay only
- `packages/types/monitor.ts` is the single source of truth for hook events and type definitions — never duplicate the `HOOK_EVENTS` array
- CLI (`claudemon-cli`) is zero-dependency by design — only Node.js built-ins

## Conventions

- Dark theme: `#0a0a0a` bg, earthy palette (safe: `#a3b18a`, suspicious: `#c9a96e`, attack: `#b85c4a`, blocked: `#8a3a2e`)
- Monospace font throughout (Geist Mono)
- Tailwind v4 with CSS custom properties
- No emojis in UI — use Phosphor icons exclusively (imported from `./Icons` wrapper)
- Extremely granular, descriptive git commits
- Never use `git add .` or `git add -A` — always add specific files by name

## Branding

- Name: "ClaudeMon" (capital C, capital M)
- Tagline: "Monitor your Claude Code sessions in real time"
- npm package: `claudemon-cli` (`claudemon` is taken by an unrelated project)
