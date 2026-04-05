# packages/cli

Published to npm as `claudemon-cli`. Zero-dependency Node.js CLI.

## Design Constraints

- Zero dependencies — only Node.js built-ins (fs, path, os, readline)
- Single file: `bin/claudemon.js` with `"type": "module"`
- Must work with `npm install -g claudemon-cli` then `claudemon-cli init`
- HOOK_EVENTS list is duplicated here (can't import from TypeScript types at runtime) — keep in sync with `packages/types/monitor.ts`

## Commands

- `claudemon-cli init` — interactive API key prompt, writes hooks to `~/.claude/settings.json`
- `claudemon-cli init --key <key>` — non-interactive setup
- `claudemon-cli --version`

## Safety

- API keys are shell-quoted with single quotes when written to rc files
- Fails with error message on malformed `settings.json` (never silently overwrites)
- Creates `~/.claude/` directory if missing
- Idempotent — deduplicates claudemon hooks, preserves all others

## Publish

```bash
# Bump version in both package.json and bin/claudemon.js
npm publish --access public
```
