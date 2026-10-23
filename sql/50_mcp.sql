-- Expose the CMO to MCP clients (Claude Desktop, Claude.ai) through the Snowflake-managed MCP server.
CREATE OR REPLACE MCP SERVER CMO_DB.CORE.CMO_MCP
  FROM SPECIFICATION
$$
tools:
  - title: "Agentic CMO"
    name: "cmo"
    identifier: "CMO_DB.CORE.CMO_AGENT"
    type: "CORTEX_AGENT_RUN"
    description: "CMO agent: where the quarter stands by channel on cost per SQL and CAC, budget reallocation memos, and annual plan unit economics."
  - title: "Marketing funnel"
    name: "funnel"
    identifier: "CMO_DB.CORE.FUNNEL_SV"
    type: "CORTEX_ANALYST_MESSAGE"
    description: "Text-to-SQL over the common funnel: spend, MQLs, SQLs, pipeline and cost per SQL by channel, campaign and day."
$$;
