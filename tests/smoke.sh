#!/usr/bin/env bash
# End-to-end run against a live API with the real exports loaded. Bar: passes 3 times in a row.
# Usage: tests/smoke.sh [runs] [base_url]
set -euo pipefail
RUNS=${1:-3}
B=${2:-http://127.0.0.1:8000}
j() { python3 -c "import json,sys; d=json.load(sys.stdin); print($1)"; }

n_channels=$(curl -sf "$B/health" | j "len(d['active_channels'])")
for run in $(seq 1 "$RUNS"); do
  start=$SECONDS
  curl -sf -X POST "$B/decisions/reset" >/dev/null
  curl -sf "$B/now/strip" | j "d['data']['measured_spend_usd']" >/dev/null || { echo "run $run: strip"; exit 1; }

  out=$(curl -sfN -X POST "$B/now/review" --max-time 500)
  grep -q "^event: error" <<<"$out" && { echo "run $run: review error"; grep -A1 "^event: error" <<<"$out"; exit 1; }
  for e in strip delegation memo cmo_delta done; do grep -q "^event: $e" <<<"$out" || { echo "run $run: missing $e"; exit 1; }; done
  [ "$(grep -c '"state": "done"' <<<"$out")" -ge "$n_channels" ] || { echo "run $run: channel agents"; exit 1; }

  memo=$(curl -sf "$B/memos" | j "d[0]['memo_id']")
  status=$(curl -sf "$B/memos" | j "d[0]['status']")
  [ "$status" = pending ] && curl -sf -X POST "$B/memos/$memo/approve" >/dev/null
  projected=$(curl -sf "$B/now/strip" | j "round(d['data']['plan_projected_sqls'], 1)")

  curl -sf "$B/plan/scenarios?budget=1000000&rule=12mo" | j "d['data']['plan']['customers']" >/dev/null
  curl -sf "$B/plan/scenarios?budget=2000000&rule=3yr" | j "d['data']['cac_bound']" >/dev/null
  echo "run $run ok: $n_channels channel agents, memo $memo ($status), plan projects $projected SQLs, $((SECONDS - start))s"
done
curl -sf -X POST "$B/decisions/reset" >/dev/null
echo "smoke: $RUNS/$RUNS passed"
