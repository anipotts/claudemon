# claudemon-cli

Set up [ClaudeMon](https://claudemon.com) hooks for Claude Code in one command.

## Install

```bash
npm install -g claudemon-cli
```

## Setup

```bash
claudemon-cli init
```

This will:

1. Prompt for your API key (get one at [app.claudemon.com](https://app.claudemon.com))
2. Add HTTP hooks for all 27 Claude Code events to `~/.claude/settings.json`
3. Save your API key to your shell profile

Safe to run multiple times. Preserves your existing hooks.

## Non-interactive

```bash
claudemon-cli init --key YOUR_API_KEY
```

## What is ClaudeMon?

A real-time monitor for Claude Code sessions. See what every session is doing across machines, branches, and projects.

- **Privacy-first** -- no file contents, API keys, or conversations are sent
- **Ephemeral** -- no persistent database, WebSocket relay only
- **Open source** -- [github.com/anipotts/claudemon](https://github.com/anipotts/claudemon)

## Requirements

- Node.js 18+
- Claude Code installed

## License

MIT
