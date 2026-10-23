"""Idempotent Snowflake setup: run every sql/*.sql in order, deploying the CMO agent after its tools exist.

Usage: python -m backend.app.setup
"""
import os
from pathlib import Path

import jinja2

from . import snowflake as sf

ROOT = Path(__file__).resolve().parents[2]
CMO_MODEL = os.getenv("CMO_MODEL", "claude-sonnet-4-5")


def deploy_cmo_agent() -> None:
    sql = jinja2.Template((ROOT / "templates" / "cmo_agent.sql.j2").read_text(), undefined=jinja2.StrictUndefined)
    sf.conn().execute_string(sql.render(model=CMO_MODEL, warehouse=sf.WAREHOUSE), remove_comments=True)


def main() -> None:
    for path in sorted((ROOT / "sql").glob("*.sql")):
        print("running", path.name)
        sf.run_script(path)
        if path.name.startswith("40_"):  # later files (MCP server) reference the agent
            deploy_cmo_agent()
            print("CMO agent deployed")


if __name__ == "__main__":
    main()
