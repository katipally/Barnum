"""Idempotent Snowflake setup: run every sql/*.sql in order, deploying the CMO agent after its tools exist.

Usage: python -m backend.app.setup                   full setup, deploys CMO_AGENT
       python -m backend.app.setup agent CMO_AGENT_V2  (re)deploy only the CMO agent, under that name
"""
import os
import sys
from pathlib import Path

import jinja2

from . import snowflake as sf

ROOT = Path(__file__).resolve().parents[2]
CMO_MODEL = os.getenv("CMO_MODEL", "claude-opus-5-5")


def deploy_cmo_agent(name: str = "CMO_AGENT") -> None:
    sql = jinja2.Template((ROOT / "templates" / "cmo_agent.sql.j2").read_text(), undefined=jinja2.StrictUndefined)
    sf.conn().execute_string(sql.render(name=sf.ident(name), model=CMO_MODEL, warehouse=sf.WAREHOUSE), remove_comments=True)


def main() -> None:
    for path in sorted((ROOT / "sql").glob("*.sql")):
        print("running", path.name)
        sf.run_script(path)
        if path.name.startswith("40_"):  # later files (MCP server) reference the agent
            deploy_cmo_agent()
            print("CMO agent deployed")


if __name__ == "__main__":
    if sys.argv[1:2] == ["agent"]:
        deploy_cmo_agent(*sys.argv[2:3])
    else:
        main()
