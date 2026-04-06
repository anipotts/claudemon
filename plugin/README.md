# ClaudeMon Plugin

Real-time session monitoring for Claude Code. Watch your sessions live at [app.claudemon.com](https://app.claudemon.com).

## Install

```
/plugin marketplace add https://github.com/anipotts/claudemon
/plugin install claudemon@claudemon
```

You'll be prompted for an API key. Get one at [app.claudemon.com](https://app.claudemon.com) > Settings > API Keys.

## What it monitors

All 27 Claude Code hook events across 4 signal tiers:

- **Tier 1 (Actions):** PermissionRequest, Notification, Elicitation
- **Tier 2 (Lifecycle):** SessionStart, SessionEnd, Stop, StopFailure, Setup
- **Tier 3 (Activity):** PreToolUse, PostToolUse, SubagentStart, SubagentStop, UserPromptSubmit, PostCompact
- **Tier 4 (Ambient):** CwdChanged, FileChanged, ConfigChange, WorktreeCreate/Remove, TaskCreated, TaskCompleted, and more

## Privacy

- Ephemeral WebSocket relay — no persistent database on the server
- All session data lives in your browser (IndexedDB)
- Optional transit encryption (AES-256) for end-to-end privacy
- Never sent: file contents, API keys, env vars, your conversation text

## Uninstall

```
/plugin uninstall claudemon
```

Hooks are automatically removed. No manual cleanup needed.

## Commands

- `/claudemon:status` — Check connection health and hook configuration

## Links

- Dashboard: [app.claudemon.com](https://app.claudemon.com)
- Landing: [claudemon.com](https://claudemon.com)
- Source: [github.com/anipotts/claudemon](https://github.com/anipotts/claudemon)
- npm (CLI alternative): [claudemon-cli](https://www.npmjs.com/package/claudemon-cli)
