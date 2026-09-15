#!/usr/bin/env bash
# Capture a thumbnail for every project URL in src/data/showcase.ts.
#
#   ./scripts/thumbs.sh          # capture only what's missing
#   ./scripts/thumbs.sh --force  # re-capture everything
#
# Output: public/thumbs/<host-slug>.jpg — the slug rule must stay in sync with
# slugFor() in src/App.tsx.

set -u
cd "$(dirname "$0")/.."

CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
OUT="public/thumbs"
TMP="$(mktemp -d)"
JOBS=4
TIMEOUT=35   # seconds per site
FORCE="${1:-}"

mkdir -p "$OUT"
trap 'rm -rf "$TMP"' EXIT

slug() {
  printf '%s' "$1" | sed -E 's#^https?://##; s#/.*$##' | tr -c 'a-zA-Z0-9' '-' | sed -E 's/-+$//'
}

shoot() {
  url="$1"
  name="$(slug "$url")"
  dest="$OUT/$name.jpg"
  if [ -f "$dest" ] && [ "$FORCE" != "--force" ]; then echo "skip  $name"; return 0; fi

  raw="$TMP/$name.png"
  # Watchdog: some student sites never fire onload, so cap each capture.
  "$CHROME" --headless=new --disable-gpu --no-sandbox --hide-scrollbars --mute-audio \
    --no-first-run --no-default-browser-check \
    --user-data-dir="$TMP/profile-$name" \
    --window-size=1200,750 --virtual-time-budget=8000 \
    --screenshot="$raw" "$url" >/dev/null 2>&1 &
  cpid=$!
  i=0
  while kill -0 "$cpid" 2>/dev/null && [ "$i" -lt "$TIMEOUT" ]; do sleep 1; i=$((i + 1)); done
  kill -9 "$cpid" 2>/dev/null
  wait "$cpid" 2>/dev/null

  if [ ! -s "$raw" ]; then echo "FAIL  $name"; return 1; fi
  if sips -s format jpeg -s formatOptions 72 -Z 800 "$raw" --out "$dest" >/dev/null 2>&1; then
    echo "ok    $name"
  else
    echo "FAIL  $name (convert)"; return 1
  fi
}

urls=$(grep -oE "url: '[^']+'" src/data/showcase.ts | sed -E "s/url: '(.*)'/\1/")
echo "$(printf '%s\n' "$urls" | wc -l | tr -d ' ') urls"

printf '%s\n' "$urls" | while IFS= read -r u; do
  [ -n "$u" ] || continue
  shoot "$u" &
  while [ "$(jobs -rp | wc -l | tr -d ' ')" -ge "$JOBS" ]; do sleep 0.3; done
done
wait
