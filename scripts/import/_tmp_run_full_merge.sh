#!/bin/bash
set -e
BATCH=batch_2026_07_06_master_seed
i=0
while true; do
  i=$((i+1))
  OUT=$(npx cross-env NODE_ENV=development tsx -r dotenv/config scripts/import/merge-staged-businesses.ts --batch=$BATCH --limit=5000 2>&1)
  echo "=== iteration $i ==="
  echo "$OUT"
  SCANNED=$(echo "$OUT" | grep -o '"scanned": [0-9]*' | grep -o '[0-9]*')
  if [ -z "$SCANNED" ] || [ "$SCANNED" -eq 0 ]; then
    echo "DONE - no more pending rows"
    break
  fi
done
