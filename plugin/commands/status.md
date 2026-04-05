---
description: Check ClaudeMon connection status and hook health
---

Check the ClaudeMon monitoring status for this session:

1. Verify the API key is configured by checking if `$CLAUDE_PLUGIN_OPTION_API_KEY` is set
2. Run `curl -sf https://api.claudemon.com/health` to check API connectivity
3. Check `~/.claude/settings.json` for claudemon hooks OR check if the claudemon plugin is active
4. Report the session_id from the current session context

Report results concisely:
- API Key: configured / missing
- API Server: reachable / unreachable  
- Hooks: active (N events) / not found
- Dashboard: https://app.claudemon.com
