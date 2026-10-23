#!/usr/bin/env bash
# End-to-end demo run against a live API. PRD bar: passes 3 times in a row.
# Usage: tests/smoke.sh [runs] [base_url]
set -euo pipefail
RUNS=${1:-3}
B=${2:-http://127.0.0.1:8000}
j() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)"; }

for run in $(seq 1 "$RUNS"); do
  start=$SECONDS
  curl -sf -X POST "$B/demo/reset" >/dev/null
  [ "$(curl -sf "$B/q4/strip" | j "d['data']['sqls']")" = 25 ] || { echo "run $run: strip"; exit 1; }

  out=$(curl -sfN -X POST "$B/q4/review" --max-time 400)
  grep -q "^event: error" <<<"$out" && { echo "run $run: review error"; grep -A1 "^event: error" <<<"$out"; exit 1; }
  for e in strip delegation memo cmo_delta done; do grep -q "^event: $e" <<<"$out" || { echo "run $run: missing $e"; exit 1; }; done
  [ "$(grep -c '"state": "done"' <<<"$out")" -ge 4 ] || { echo "run $run: channel agents"; exit 1; }

  memo=$(curl -sf "$B/memos?status=pending" | j "d[0]['memo_id']")
  curl -sf -X POST "$B/memos/$memo/approve" >/dev/null
  after=$(curl -sf "$B/q4/strip" | j "round(d['data']['projected_sqls_remaining'], 1)")
  python3 -c "assert $after > 24.9, $after"

  curl -sf "$B/plan/scenarios?budget=1000000&rule=12mo" | j "d['data']['plan']['customers']" >/dev/null
  curl -sf "$B/plan/scenarios?budget=2000000&rule=3yr" | j "d['data']['cac_bound']" >/dev/null
  echo "run $run ok: memo $memo approved, projected SQLs 24.9 -> $after, $((SECONDS - start))s"
done
curl -sf -X POST "$B/demo/reset" >/dev/null
echo "smoke: $RUNS/$RUNS passed"
