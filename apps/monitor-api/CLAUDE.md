# apps/monitor-api

Hono Worker on Cloudflare Workers with Durable Objects for WebSocket relay.

## Stack

- Hono web framework on Cloudflare Workers
- Durable Objects (SessionRoom) with Hibernation API for WebSocket persistence
- KV namespace `API_KEYS` for API key storage and device auth

## Key Files

- `src/index.ts` — Hono routes, WebSocket upgrade, event ingestion
- `src/session-room.ts` — Durable Object managing per-user WebSocket rooms
- `src/auth.ts` — GitHub OAuth + API key validation

## Bindings (wrangler.toml)

- `SESSION_ROOM` — Durable Object binding
- `API_KEYS` — KV namespace for API keys
- Custom domains: `api.claudemon.com`, `claudemon.com`
- Staging env: `staging-api.claudemon.com`

## Deploy

```bash
wrangler deploy           # Production
wrangler deploy --env staging  # Staging
```
