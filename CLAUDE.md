# OpenProof

Real-time distillation attack detection for LLMs. Detects model extraction, chain-of-thought harvesting, capability probing, safety boundary mapping, reward model grading, and censorship rewrite attacks.

## Architecture

```
openproof/
├── apps/
│   ├── web/          ← Next.js 16 dashboard (Cloudflare Pages)
│   └── api/          ← Hono Worker (Cloudflare Workers + Workers AI)
├── packages/
│   └── types/        ← Shared TypeScript types
├── tools/
│   ├── mcp-server/   ← Python MCP server (local dev, sentence-transformers)
│   ├── evals/        ← Eval suite (F1=0.94, 100% recall)
│   └── pipeline.py   ← Ghost supply chain CLI
├── ghost-patches/    ← Lightning AI compatibility patches for Ghost
├── skills/           ← MCP skill definitions
└── schema.sql        ← Original Postgres schema
```

## Dev Commands

```bash
# Dashboard (Next.js)
cd apps/web && npm run dev

# API Worker (local)
cd apps/api && npm run dev

# Python MCP server (local, needs sentence-transformers)
python tools/mcp-server/server.py --http --port 8001

# Evals
python tools/evals/test_local.py

# Deploy
cd apps/api && wrangler deploy
cd apps/web && npm run build:cf
```

## Environment Variables

| Variable | Where | Required | Description |
|----------|-------|----------|-------------|
| `ANTHROPIC_API_KEY` | Worker secret | No | Enables Stage 2 Claude verification |
| `NEXT_PUBLIC_API_URL` | Pages env | No | API Worker URL (defaults to `/api`) |
| `GHOST_API_URL` | Worker var | No | Ghost API endpoint |

## Related Repos

- [Validia-AI/distillery](https://github.com/Validia-AI/distillery) — synthetic attack dataset generator
- [vaulpann/ghost](https://github.com/vaulpann/ghost) — supply chain security monitor
- [vaulpann/utopia](https://github.com/vaulpann/utopia) — codebase instrumentation CLI

## Conventions

- Dark theme: `#0a0a0a` bg, earthy palette (safe: `#a3b18a`, suspicious: `#c9a96e`, attack: `#b85c4a`, blocked: `#8a3a2e`)
- Monospace font throughout (Geist Mono)
- Tailwind v4 with CSS custom properties
- Extremely granular, descriptive git commits

---

# ClaudeMon

Real-time Claude Code session monitor at claudemon.com. Monitor all sessions across machines, branches, projects — see what each is doing, detect file conflicts, know when Claude needs your input.

## ClaudeMon Architecture

```
apps/
├── monitor/          ← SolidJS + Vite + Tailwind v4 frontend (Cloudflare Pages)
├── monitor-api/      ← Hono Worker + Durable Objects WebSocket relay (Cloudflare Workers)
└── desktop/          ← Tauri v2 scaffold (not yet built)
```

- `~/.claudemon-hook.sh` — bash hook that reads Claude Code's JSON stdin, extracts session_id/tool_name/tool_input/tool_response, POSTs to api.claudemon.com

## ClaudeMon URLs

| URL | What |
|-----|------|
| `app.claudemon.com` | Production frontend |
| `staging.claudemon.com` | Staging frontend |
| `api.claudemon.com` | Worker API + WebSocket |
| `claudemon.com` | Needs landing page (currently serves same as app) |

## ClaudeMon Dev Commands

```bash
# Frontend
cd apps/monitor && npm run dev

# API Worker
cd apps/monitor-api && npm run dev

# Deploy
cd apps/monitor-api && wrangler deploy
cd apps/monitor && wrangler pages deploy dist
```

## ClaudeMon Key Decisions

- SolidJS over React for fine-grained reactivity (WebSocket events update individual DOM nodes)
- Durable Objects with Hibernation API for WebSocket persistence across DO sleep
- DO storage for session state persistence
- tool_use_id deduplication merges PreToolUse + PostToolUse into single events
- Ghost session prevention: hook rejects missing session_id, DO rejects unknown-* prefixes, auto-stale after 10min
- Privacy-first: no persistent database, ephemeral WebSocket relay only

## ClaudeMon Hook Data (from Claude Code JSON stdin)

- session_id, transcript_path, cwd, permission_mode, hook_event_name
- tool_name, tool_input (full), tool_response (full including structuredPatch for edits)
- tool_use_id (for dedup)

## ClaudeMon Branding

- Name: "ClaudeMon" (capital C, capital M)
- Tagline: "Monitor your Claude Code sessions in real time"
