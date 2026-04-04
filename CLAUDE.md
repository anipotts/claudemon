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
