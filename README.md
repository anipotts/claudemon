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

## License

MIT
