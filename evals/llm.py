"""Cortex COMPLETE with per-thread connections and an on-disk cache, so sweeps run in parallel and reruns are free."""
from __future__ import annotations

import hashlib
import json
import threading
import time
from pathlib import Path

CACHE_DIR = Path(__file__).parent / ".llm_cache"
_local = threading.local()


def _conn():
    if getattr(_local, "conn", None) is None:
        import snowflake.connector

        from backend.app import snowflake as sf

        c = snowflake.connector.connect(connection_name=sf.CONNECTION)
        c.cursor().execute(f"USE WAREHOUSE {sf.WAREHOUSE}")
        _local.conn = c
    return _local.conn


def complete(model: str, system: str, user: str, max_tokens: int = 1500) -> dict:
    """Returns {text, prompt_tokens, completion_tokens, seconds, cached}. Temperature 0 for reproducibility."""
    key = hashlib.sha256(json.dumps([model, system, user, max_tokens]).encode()).hexdigest()[:24]
    path = CACHE_DIR / f"{key}.json"
    if path.exists():
        return {**json.loads(path.read_text()), "cached": True}
    messages = json.dumps([{"role": "system", "content": system}, {"role": "user", "content": user}])
    options = json.dumps({"temperature": 0, "max_tokens": max_tokens})
    last_error = None
    for attempt in range(3):
        t = time.time()
        try:
            cur = _conn().cursor()
            cur.execute("SELECT SNOWFLAKE.CORTEX.COMPLETE(%s, PARSE_JSON(%s)::ARRAY, PARSE_JSON(%s)::OBJECT)", [model, messages, options])
            d = json.loads(cur.fetchone()[0])
            out = {"text": d["choices"][0]["messages"], "prompt_tokens": d["usage"].get("prompt_tokens", 0),
                   "completion_tokens": d["usage"].get("completion_tokens", 0), "seconds": round(time.time() - t, 2)}
            CACHE_DIR.mkdir(exist_ok=True)
            path.write_text(json.dumps(out))
            return {**out, "cached": False}
        except Exception as e:  # transient Cortex errors: retry with backoff
            last_error = e
            time.sleep(2 * (attempt + 1))
    raise RuntimeError(f"{model}: {last_error}")
