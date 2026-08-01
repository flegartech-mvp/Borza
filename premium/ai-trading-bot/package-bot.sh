#!/usr/bin/env sh
set -eu

if [ "$#" -ne 1 ]; then
  echo "Usage: $0 /path/to/authorized/ai-bot-source" >&2
  exit 2
fi

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
python3 "$SCRIPT_DIR/package_bot.py" \
  --source "$1" \
  --output "$SCRIPT_DIR/artifacts/borza-ai-trading-bot.zip"
