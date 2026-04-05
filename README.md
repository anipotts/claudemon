# ClaudeMon

Monitor your Claude Code sessions in real time.

See what every session is doing across machines, branches, and projects. Detect file conflicts. Know when Claude needs your input.

## Install

```bash
npm install -g claudemon-cli
claudemon-cli init
```

This adds hooks to your Claude Code config and saves your API key. Get your key at [app.claudemon.com](https://app.claudemon.com).

## How it works

Claude Code fires [hook events](https://docs.anthropic.com/en/docs/claude-code/hooks) on every tool use, session start/end, notification, and more. ClaudeMon registers HTTP hooks for all 27 events, forwarding them to a lightweight WebSocket relay. The dashboard connects via WebSocket and renders session state in real time.

**Privacy-first:** No persistent database. No file contents, API keys, or conversations are ever sent. Events are ephemeral WebSocket messages — nothing is stored.

## Architecture

```
apps/monitor/        SolidJS frontend         app.claudemon.com
apps/monitor-api/    Hono + Durable Objects   api.claudemon.com
packages/cli/        claudemon-cli on npm
packages/types/      Shared TypeScript types
```

## Development

```bash
cd apps/monitor && npm run dev       # Frontend
cd apps/monitor-api && npm run dev   # API
```

## Deploy

```bash
cd apps/monitor-api && wrangler deploy
cd apps/monitor && npm run build && wrangler deploy
```

## Self-Hosting

Run your own ClaudeMon instance on Cloudflare Workers (free tier):

```bash
# Clone and deploy
git clone https://github.com/anipotts/claudemon.git
cd claudemon/apps/monitor-api
wrangler deploy -c wrangler.self-hosted.toml
```

Self-hosted mode runs in `SINGLE_USER` mode — no GitHub OAuth or API keys required. All sessions are visible to anyone with the URL.

For the frontend, deploy `apps/monitor` to Cloudflare Pages and set `VITE_MONITOR_API_URL` to your worker URL.

## License

MIT
