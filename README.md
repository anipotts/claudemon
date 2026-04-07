# ClaudeMon

[![npm](https://img.shields.io/npm/dw/claudemon-cli?style=flat&color=a3b18a&labelColor=1a1916&label=npm)](https://www.npmjs.com/package/claudemon-cli)
[![License: MIT](https://img.shields.io/badge/license-MIT-a3b18a?labelColor=1a1916)](LICENSE)

Real-time session monitoring for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

See what every session is doing across projects, branches, and machines. Track tool calls, agent hierarchies, and context compactions. Know when Claude needs your input.

if claudemon helped you, [star it](https://github.com/anipotts/claudemon). it helps others find it.

**[app.claudemon.com](https://app.claudemon.com)**

## Quick Start

```bash
npm install -g claudemon-cli
claudemon-cli init
```

Get your API key at [app.claudemon.com](https://app.claudemon.com), then open Claude Code. Sessions appear on the dashboard immediately.

## How It Works

Claude Code fires [hook events](https://docs.anthropic.com/en/docs/claude-code/hooks) on every tool use, session lifecycle change, and notification. ClaudeMon registers async command hooks for 12 core events, forwarding them to a lightweight WebSocket relay. The dashboard connects via WebSocket and renders session state in real time.

**Privacy-first:** No persistent database. No file contents stored. Events are ephemeral WebSocket messages that exist only while you're connected.

## Features

- Live session timeline with tool calls, diffs, and bash output
- Conversation-style display (user prompts, Claude responses, tool work)
- Agent hierarchy nesting (SubagentStart/Stop with collapsible blocks)
- Tool call duration tracking (Pre/Post timestamp diff)
- Bash command classification (git, npm, test, docker, curl)
- Model and permission mode badges (color-coded by family/risk)
- Multi-session tabs and side-by-side column view
- Cross-session activity feed with filters (tools, lifecycle, prompts, agents, errors)
- File conflict detection across concurrent sessions
- Browser push notifications when Claude needs input
- Keyboard navigation (j/k to move, Enter to expand)

## Architecture

```
apps/monitor/        SolidJS + Tailwind v4 frontend     app.claudemon.com
apps/monitor-api/    Hono + Durable Objects relay        api.claudemon.com
packages/cli/        claudemon-cli (zero dependencies)
packages/types/      Shared TypeScript types
```

All components deploy to Cloudflare (Pages + Workers). The API uses Durable Objects with the Hibernation API for persistent WebSocket connections that survive DO sleep.

## Development

```bash
git clone https://github.com/anipotts/claudemon.git
cd claudemon && npm install

cd apps/monitor && npm run dev       # Frontend at localhost:5173
cd apps/monitor-api && npm run dev   # API at localhost:8787
```

```bash
npm run test        # 121 tests (vitest)
npm run build       # Production build
npm run lint        # Biome check
```

## Self-Hosting

Run your own instance on Cloudflare Workers (free tier):

```bash
cd apps/monitor-api
wrangler deploy -c wrangler.self-hosted.toml
```

Self-hosted mode runs in `SINGLE_USER` mode. No OAuth or API keys required.

For the frontend, deploy `apps/monitor` to Cloudflare Pages with `VITE_MONITOR_API_URL` set to your worker URL.

## Contributing

PRs welcome. Please follow the conventions in [CLAUDE.md](CLAUDE.md).

## part of [claude-code-tips](https://github.com/anipotts/claude-code-tips)

claudemon is one piece of a larger system for working with claude code effectively.

- **[claude-code-tips](https://github.com/anipotts/claude-code-tips)** · the patterns behind this tool
- **[cc](https://github.com/anipotts/cc)** · cross-session messaging
- **[mine](https://github.com/anipotts/mine)** · session mining to sqlite
- **[imessage-mcp](https://github.com/anipotts/imessage-mcp)** · iMessage MCP server

## more from me

- [anipotts.com/thoughts](https://anipotts.com/thoughts) · long-form
- [buttondown.com/anipotts](https://buttondown.com/anipotts) · newsletter
- [@anipottsbuilds](https://instagram.com/anipottsbuilds) · short-form

## License

MIT
