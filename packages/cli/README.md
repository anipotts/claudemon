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
2. Register async command hooks for 12 core Claude Code events in `~/.claude/settings.json`
3. Embed your API key in the hook configuration

Hooks activate immediately -- no restart needed. Safe to run multiple times.

## Commands

```bash
claudemon-cli init              # Interactive setup
claudemon-cli init --key KEY    # Non-interactive setup
claudemon-cli status            # Check hook config, API connectivity, curl availability
claudemon-cli migrate           # Upgrade from v0.5.x HTTP hooks to v0.6.0 async hooks
claudemon-cli --version         # Show version
```

## What is ClaudeMon?

A real-time monitor for Claude Code sessions. See what every session is doing across machines, branches, and projects.

- **Non-blocking** -- async command hooks add zero latency to Claude Code
- **Privacy-first** -- no file contents, API keys, or conversations are sent
- **Ephemeral** -- no persistent database, WebSocket relay only
- **Zero dependencies** -- only Node.js built-ins

## Monitored Events

The CLI registers hooks for 12 core events (reduced from 27 to eliminate noise):

`SessionStart` `SessionEnd` `Setup` `PreToolUse` `PostToolUse` `Stop` `StopFailure` `SubagentStart` `SubagentStop` `UserPromptSubmit` `Notification` `PostCompact`

## Requirements

- Node.js 18+
- curl (for async hook transport)
- Claude Code installed

## License

MIT
