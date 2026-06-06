#!/usr/bin/env bash
set -euo pipefail

# Usage:
# 1) Export DEEPSEEK_API_KEY in your shell, or place the key in
#    .vscode/deepseek-copilot-endpoint.json (requires jq).
# 2) Run: ./scripts/test_deepseek.sh "Hello"

API_URL="https://api.deepseek.com/v1/chat/completions"
CONFIG_FILE=".vscode/deepseek-copilot-endpoint.json"

PROMPT="${1:-ping}"

# Get API key from env, otherwise try config file (needs jq)
API_KEY="${DEEPSEEK_API_KEY-}"
if [ -z "$API_KEY" ]; then
  if [ -f "$CONFIG_FILE" ] && command -v jq >/dev/null 2>&1; then
    API_KEY=$(jq -r '.[0].apiKey // empty' "$CONFIG_FILE")
  fi
fi

if [ -z "$API_KEY" ]; then
  echo "ERROR: API key not found. Set DEEPSEEK_API_KEY or install jq and add key to $CONFIG_FILE"
  exit 1
fi

# Build JSON body safely
BODY=$(jq -n --arg model "deepseek-chat" --arg prompt "$PROMPT" '{model:$model, messages:[{role:"user", content:$prompt}] }')

echo "POST $API_URL"
echo "Payload: $BODY"

# Send request
if command -v jq >/dev/null 2>&1; then
  curl -sS -X POST "$API_URL" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$BODY" | jq .
else
  curl -sS -X POST "$API_URL" \
    -H "Authorization: Bearer $API_KEY" \
    -H "Content-Type: application/json" \
    -d "$BODY"
fi
