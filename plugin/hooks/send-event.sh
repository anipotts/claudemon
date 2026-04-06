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
# API key: try plugin userConfig first, then file-based fallback
API_KEY="${CLAUDE_PLUGIN_OPTION_API_KEY:-}"
if [ -z "$API_KEY" ] && [ -f "$HOME/.claudemon/api-key" ]; then
  API_KEY="$(cat "$HOME/.claudemon/api-key" 2>/dev/null || true)"
fi
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
     with_entries(select(.value != null and .value != ""))')
else
  PAYLOAD="$INPUT"
fi

# -- Transit encryption (if key is set) -----------------------------------
ENCRYPTION_KEY="${CLAUDEMON_ENCRYPTION_KEY:-}"
if [ -n "$ENCRYPTION_KEY" ] && command -v openssl &>/dev/null && command -v jq &>/dev/null; then
  # Split into plaintext routing fields + sensitive content
  PLAINTEXT=$(echo "$PAYLOAD" | jq -c '{session_id, machine_id, timestamp, hook_event_name, tool_name, tool_use_id}')
  SENSITIVE=$(echo "$PAYLOAD" | jq -c 'del(.session_id, .machine_id, .timestamp, .hook_event_name, .tool_name, .tool_use_id)')
  # Encrypt sensitive fields with AES-256-CBC + HMAC-SHA256
  IV=$(openssl rand -hex 16)
  KEY_HEX=$(echo -n "$ENCRYPTION_KEY" | head -c 64)
  ENCRYPTED=$(echo -n "$SENSITIVE" | openssl enc -aes-256-cbc -K "$KEY_HEX" -iv "$IV" -a -A 2>/dev/null || echo "")
  if [ -n "$ENCRYPTED" ]; then
    MAC=$(echo -n "${IV}${ENCRYPTED}" | openssl dgst -sha256 -mac HMAC -macopt "hexkey:${KEY_HEX}" -hex 2>/dev/null | awk '{print $NF}')
    ENVELOPE=$(jq -nc --arg iv "$IV" --arg ct "$ENCRYPTED" --arg mac "$MAC" '{v:1,alg:"aes-256-cbc-hmac",iv:$iv,ct:$ct,mac:$mac}')
    PAYLOAD=$(echo "$PLAINTEXT" | jq -c --argjson enc "$ENVELOPE" '. + {_encrypted: $enc}')
  fi
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
