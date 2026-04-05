#!/usr/bin/env bash
# ClaudeMon hook — async, batched event sender.
# Reads hook input JSON from stdin, enriches with local context,
# appends to a per-session batch file, and starts a background
# flush daemon that POSTs batches to the API every 2 seconds.
#
# Non-blocking: Claude Code runs this with async:true so it never
# blocks the model turn. Fault-tolerant: curl failures are silently
# swallowed to prevent hook errors from disrupting sessions.
set -euo pipefail

API_URL="${CLAUDEMON_API_URL:-https://api.claudemon.com}"
API_KEY="${CLAUDE_PLUGIN_OPTION_API_KEY:-}"
INPUT="$(cat)"

# Extract session_id for batch file naming
SID=$(echo "$INPUT" | grep -o '"session_id":"[^"]*"' | head -1 | cut -d'"' -f4 || echo "unknown")

# Enrich with machine-local context not available in hook payloads
MACHINE_ID="$(hostname -s 2>/dev/null || echo 'unknown')"
BRANCH=""
PROJECT_PATH="$PWD"
if git rev-parse --is-inside-work-tree &>/dev/null 2>&1; then
  BRANCH="$(git branch --show-current 2>/dev/null || true)"
  PROJECT_PATH="$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")"
fi

# Build payload — jq for clean JSON, fallback to raw stdin
if command -v jq &>/dev/null; then
  PAYLOAD=$(echo "$INPUT" | jq -c \
    --arg mid "$MACHINE_ID" \
    --arg br "$BRANCH" \
    --arg pp "$PROJECT_PATH" \
    --argjson ts "$(date +%s)000" \
    '. + {machine_id: $mid, branch: $br, project_path: $pp, timestamp: $ts} |
     if .tool_input then .tool_input = (.tool_input | tostring | .[:2048]) else . end |
     if .tool_response then .tool_response = (.tool_response | tostring | .[:2048]) else . end |
     with_entries(select(.value != null and .value != ""))')
else
  PAYLOAD="$INPUT"
fi

# -- Batch: append payload to session batch file -------------------------
BATCH_DIR="${TMPDIR:-/tmp}"
BATCH_FILE="${BATCH_DIR}/claudemon-${SID}.batch"
LOCK_FILE="${BATCH_DIR}/claudemon-flush-${SID}.lock"
echo "$PAYLOAD" >> "$BATCH_FILE"

# -- Start background flush daemon if not already running ----------------
if ! [ -f "$LOCK_FILE" ]; then
  touch "$LOCK_FILE"
  (
    IDLE=0
    while [ $IDLE -lt 150 ]; do
      sleep 2
      if [ ! -s "$BATCH_FILE" ]; then
        IDLE=$((IDLE + 2))
        continue
      fi
      IDLE=0
      LINES="$(cat "$BATCH_FILE")"
      : > "$BATCH_FILE"
      BODY="[$(echo "$LINES" | paste -sd ',' -)]"
      curl -sf -X POST "${API_URL}/events/batch" \
        -H "Content-Type: application/json" \
        -H "Authorization: Bearer ${API_KEY}" \
        -d "$BODY" --max-time 5 >/dev/null 2>&1 || true
    done
    rm -f "$LOCK_FILE"
  ) &
  disown
fi
exit 0
