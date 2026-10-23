# Security: least-privilege roles and CRM data protection

Everything in `CMO_DB` is owned by `ATTENDEE_ROLE`. The backend reaches it through one PAT that is restricted to that role. `sql/70_security.sql` adds narrower roles beside it, plus Horizon tags and masking on personal columns. The script only adds roles, grants, tags and policies. It never revokes anything from `ATTENDEE_ROLE`.

```bash
snow sql -c hackathon -f sql/70_security.sql
```

Run it as `ATTENDEE_ROLE` after every setup run, after a new channel, and after a new `RAW_*` table. It is idempotent. Re-running matters because `CREATE OR REPLACE` on a procedure or the MCP server drops that object's grants. Future grants only cover views, semantic views, functions and agents.

## Roles

| Role | Can | Cannot |
|---|---|---|
| `CMO_READER` | Read all `CORE` views, `FUNNEL_SV`, and five decision tables (`ASSUMPTIONS`, `CHANNEL_REGISTRY`, `ALLOCATION`, `DECISION_LOG`, `MAPPING_HISTORY`). Read every channel's `MAP`, `NATIVE_METRICS`, `SV` and existing `RAW_*` tables, with personal columns masked. Use `CMO_AGENT`, the channel agents and the `CMO_MCP` server. Call the read-only `CORE` functions plus `ASK_CHANNEL`, `UNIT_ECON` and `PROPOSE_REALLOCATION`. | Write any table. Call `DECIDE_MEMO`, `APPLY_MEMO`, `RESET_DECISIONS` or `REBUILD_FUNNEL`. Read `EVALS`. See PII. |
| `CMO_DECIDER` | Call `DECIDE_MEMO` (plus warehouse, database and `CORE` usage). | Anything else, including reading memos. A human approver gets both `CMO_READER` and `CMO_DECIDER`. |
| `CMO_CHANNEL_<X>` (one per channel, e.g. `CMO_CHANNEL_OUTBOUND`) | Everything in `CH_<X>`: raw tables (masked), `MAP`, `SV`, `REPORT`, `RECONCILE`, `AGENT`. | Any other channel schema, or `CORE`. |
| `CMO_PII_ADMIN` | See personal columns unmasked. Granted to the user `USER`, so a Snowsight login sees raw values. | Grants nothing else. |

All new roles except `CMO_PII_ADMIN` are granted to `ATTENDEE_ROLE`, so the owner role keeps the full hierarchy.

Deliberate choices:

- **`PROPOSE_REALLOCATION` is open to readers.** It is a `CMO_AGENT` tool. It writes only a memo, through owner's rights, and it applies a memo by itself only when the move is under `AUTONOMY_LIMIT_PCT`, which readers cannot change. Anything larger stays `pending` until a decider approves it. To make readers fully read-only, run `REVOKE USAGE ON PROCEDURE CMO_DB.CORE.PROPOSE_REALLOCATION(FLOAT) FROM ROLE CMO_READER`.
- **`APPLY_MEMO` is not granted to anyone new.** `DECIDE_MEMO` checks that a memo is `pending` and then calls `APPLY_MEMO` with owner's rights. Calling `APPLY_MEMO` directly skips that check, so a caller could re-apply a rejected or superseded memo.
- **New raw tables fail closed.** The new roles get `SELECT` on existing `RAW_*` tables only, never future ones. An upload is unreadable to them until this script has tagged and masked it. Views, semantic views, functions and agents do have future grants, because channel approval replaces them.
- **No future tables in `CORE`.** If a `RAW_CRM_LEADS` table lands there, it is not exposed by default.

### Why `CMO_PII_ADMIN` is not granted to `ATTENDEE_ROLE`

An owner's-rights procedure evaluates masking policies as its owner, not as the caller. Verification proved this: a procedure owned by a PII-admin role returned unmasked rows when called by `CMO_READER`. `ASK_CHANNEL` is such a procedure, owned by `ATTENDEE_ROLE`, and readers reach it through `CMO_AGENT`. If the owner held `CMO_PII_ADMIN`, every reader would get raw names and emails through the CMO agent. So `ATTENDEE_ROLE` sees masked values too. No funnel number depends on a masked column; this is checked below.

### Secondary roles

`USER` has `DEFAULT_SECONDARY_ROLES = ('ALL')`. In a Snowsight session, every role granted to the user is therefore active, including `ATTENDEE_ROLE` and `CMO_PII_ADMIN`, even when `CMO_READER` is the primary role. PAT sessions with a role restriction and Snowflake OAuth sessions (`OAUTH_USE_SECONDARY_ROLES = NONE`) do not use secondary roles. To test a role in Snowsight, first run `USE SECONDARY ROLES NONE`.

## PII masking and Horizon tags

Tags and policies live in `CMO_DB.GOVERNANCE`.

- Tag `PII`, with values `email`, `name`, `phone` and `free_text`, goes on every personal column.
- Tag `MASKING_EXEMPT` records why a PII column is left unmasked.
- `MASK_EMAIL` turns `jane.doe@acme.com` into `***@acme.com`, including inside `CC` lists. The domain is kept for company-level analysis.
- `MASK_NAME` returns `***`.
- `MASK_TEXT` returns `[masked 597 chars]`.

Every policy shows the raw value only when `IS_ROLE_IN_SESSION('CMO_PII_ADMIN')`.

The second block of the script holds a candidate list of personal columns. For each candidate that exists, it sets the `PII` tag. It then masks the column only when no view, procedure or function in `CMO_DB` names the column together with its table. Otherwise it unsets any mask and sets `MASKING_EXEMPT = 'used by <objects>'`. So if a remapped channel starts using a masked column, the next run unmasks it rather than letting the numbers differ by role. The guard proved itself during verification: it unmasked a column that a temporary probe procedure read.

Semantic views are not in `INFORMATION_SCHEMA`, so they were checked by hand with `GET_DDL('SEMANTIC_VIEW', ...)`. Only `CH_OUTBOUND.SV` and `CH_EMAIL_THREADS.SV` reference personal columns, and only as dimensions. No fact or metric uses them, so masking changes what those dimensions display and no number. Re-check after a remap:

```sql
SELECT GET_DDL('SEMANTIC_VIEW', 'CMO_DB.CH_OUTBOUND.SV');  -- PII may appear in dimensions(...), never in facts/metrics
SELECT * FROM TABLE(CMO_DB.INFORMATION_SCHEMA.POLICY_REFERENCES(
  REF_ENTITY_NAME => 'CMO_DB.CH_OUTBOUND.RAW_DATASAUR_OUTBOUND_EMAILS', REF_ENTITY_DOMAIN => 'table'));
SELECT * FROM TABLE(CMO_DB.INFORMATION_SCHEMA.TAG_REFERENCES_ALL_COLUMNS(
  'CMO_DB.CH_OUTBOUND.RAW_DATASAUR_OUTBOUND_EMAILS', 'table'));
```

### What is masked (14 columns, live 2026-10-23)

| Table | Masked columns |
|---|---|
| `CH_OUTBOUND.RAW_DATASAUR_OUTBOUND_EMAILS` | `FROM_EMAIL`, `CC`, `BCC` (email); `TO_NAME`, `FROM_NAME` (name); `BODY_HTML`, `REPLY_MESSAGE` (free text) |
| `CH_EMAIL_THREADS.RAW_DATASAUR_EMAIL_THREADS` | `TO_EMAIL`, `FROM_EMAIL`, `CC` (email); `TO_NAME`, `FROM_NAME` (name); `BODY_TEXT`, `BODY_HTML` (free text) |

### Deliberately left unmasked

| Column | Why |
|---|---|
| `CH_OUTBOUND.RAW_DATASAUR_OUTBOUND_EMAILS.TO_EMAIL` (tagged `PII = email`, `MASKING_EXEMPT`) | `CH_OUTBOUND.MAP` counts contacts by `LOWER(TRIM(TO_EMAIL))` and drops internal `%datasaur%` addresses. A masked value would change outbound MQLs and SQLs for every masked role. Readers therefore see recipient emails through the raw table and the Outbound SV. One option would keep the numbers while hiding the address: a deterministic mask such as `SHA2(LOWER(TRIM(v))) \|\| '@' \|\| domain`, which keeps distinct counts and the domain filter. It needs a check that no internal address carries "datasaur" only in its local part, and it is not applied. |
| `SUBJECT`, `TO_COMPANY`, `PROSPECT_COMPANY` (not tagged) | `MAP` uses them as `creative_text` and `audience`. Company names are not personal data. Subjects can contain a first name (`{first_name}, quick question`); that residual risk is accepted. |
| `CORE.RAW_CRM_LEADS` | The table does not exist in the live DB today. The script lists `EMAIL`, `FIRST_NAME`, `LAST_NAME` and `PHONE` as candidates, and the guard decides when the table appears. In CRM mode a mapping may join on `EMAIL`, which would leave it exempt. `JOB_TITLE` and `COMPANY` are not candidates, because the MQL rule filters on title and company. |
| LinkedIn `ACCOUNT_NAME`, GEO, SEO, Google, billboard and conference tables | No personal data: ad accounts, campaigns, brands, queries, aggregates. |

New columns added to an existing `RAW_*` table by `ingest.load_csv` (`ALTER TABLE ADD COLUMN`) are readable unmasked until they are added to the candidate list and the script is re-run.

## Verification (2026-10-23)

The session's PAT is restricted to `ATTENDEE_ROLE`. A restricted PAT session cannot run `USE ROLE`, and it cannot create PATs for its own user. So each new role was exercised through a temporary owner's-rights procedure owned by that role, which runs with exactly that role's grants (`CURRENT_ROLE()` returned `CMO_READER`, and `IS_ROLE_IN_SESSION('CMO_PII_ADMIN')` returned false). The probe schema `CMO_DB.SECURITY_PROBE` was dropped afterwards.

| Check | Result |
|---|---|
| `ATTENDEE_ROLE` snapshot before vs. after masking: `EXEC_STRIP`, `CHANNEL_SUMMARY`, `FUNNEL_FACT` per channel, `FUNNEL_METRICS_LONG` per metric, all 8 `RECONCILE()` calls | byte-identical |
| `CMO_READER`: `EXEC_STRIP`, `CHANNEL_SUMMARY`, `FUNNEL_FACT`, `SEMANTIC_VIEW(FUNNEL_SV ...)`, `CHANNEL_STATS('google')`, `CHANNEL_STATS('outbound')`, `CH_OUTBOUND.RECONCILE()`, `CH_OUTBOUND.REPORT()` | all OK, same numbers (for example 2,623 MQLs; Outbound 86 MQLs / 77 SQLs, 647 contacts) |
| `CMO_READER` asks `CMO_AGENT` "How many MQLs did Outbound Email produce, and what share?" | "Outbound produced 86 MQLs ... 3.3% of the 2,623 MQLs" |
| `CMO_READER` reads `RAW_DATASAUR_OUTBOUND_EMAILS` | `TO_NAME = ***`, `FROM_EMAIL = ***@datasaur.ai`, `CC = ***@wpsic.com, ...`, `REPLY_MESSAGE = [masked 11000 chars]`, `TO_EMAIL` clear (exempt) |
| `CMO_READER` asks the Outbound agent, and `ASK_CHANNEL('email_threads', ...)`, for names and emails | agents answer with `***` and `***@domain` |
| `CMO_READER` denied | `DELETE`/`UPDATE` on `ASSUMPTIONS`/`ALLOCATION`, `DECIDE_MEMO`, `RESET_DECISIONS`, `REBUILD_FUNNEL`, `EVALS` |
| `CMO_CHANNEL_OUTBOUND` | own `MAP`, `RAW_*` (masked), `RECONCILE`, `REPORT` and agent OK; `CH_GOOGLE`, `CH_EMAIL_THREADS`, `CORE` and `ASK_CHANNEL` denied |
| `CMO_DECIDER` | `DECIDE_MEMO('M-does-not-exist', 'approved')` returns `unknown memo` (no write); `APPLY_MEMO`, `PROPOSE_REALLOCATION`, `RESET_DECISIONS`, `DECISION_LOG`, `EXEC_STRIP` denied |
| Live backend after the change | `/health`, `/q4/strip`, `/memos`, `/assumptions`, `/channels`, `/plan/scenarios` all 200 |

Not covered by the checks:

- `tests/test_numbers.py` errors in its fixture before running any test. It calls `CMO_DB.CORE.RESET_DEMO`, which does not exist in the live DB (it has `RESET_DECISIONS`), and it asserts the old PRD seed numbers. It is stale against the current `CMO_DB`, independent of this change.
- `/q4/channels` returns 500 because it reads `CORE.Q4_PROJECTION`, which also does not exist live. It touches no masked column.

## Switching the backend to `CMO_READER`

Do this when the demo can take a restart. Nothing here has been changed.

1. **Create a PAT bound to the role.** A PAT session cannot create PATs for its own user, so do this in Snowsight (password login) as `USER`:

   ```sql
   ALTER USER "USER" ADD PROGRAMMATIC ACCESS TOKEN CMO_READER_PAT
     ROLE_RESTRICTION = 'CMO_READER' DAYS_TO_EXPIRY = 14
     COMMENT = 'Agentic CMO backend, read-only';
   ```

   Copy `token_secret`; it is shown once. `USER` already has `CMO_READER` through `ATTENDEE_ROLE`, and the existing network policy `HACK_NP` satisfies the PAT requirement. For production, use a `TYPE = SERVICE` user instead. That needs `USERADMIN`, which `ATTENDEE_ROLE` does not have.

2. **Add a second connection** to `~/.snowflake/connections.toml`. Leave `[hackathon]` untouched:

   ```toml
   [cmo_reader]
   account = "SFSEHOL-ANTHROPIC_SNOWFLAKE_HACKATHON_EKYTMN"
   user = "USER"
   authenticator = "PROGRAMMATIC_ACCESS_TOKEN"
   token = "<token_secret>"
   role = "CMO_READER"
   warehouse = "CMO_WH"
   ```

3. **Start the backend on it.** `backend/app/snowflake.py` reads `CMO_CONNECTION`, and the Agent Run REST calls reuse the same token:

   ```bash
   CMO_CONNECTION=cmo_reader uv run uvicorn backend.app.main:app --port 8000
   ```

Under `CMO_READER`, the dashboard, `/ask`, the plan, `/q4/reallocate` and memo listing work. These need more:

- `POST /memos/{id}/{decision}` needs `CMO_DECIDER`. Create an app role holding both, then bind the PAT to it:

  ```sql
  CREATE ROLE CMO_APP; GRANT ROLE CMO_READER TO ROLE CMO_APP; GRANT ROLE CMO_DECIDER TO ROLE CMO_APP;
  ```

- Uploads, mapping approval, `/simulate`, `/demo/reset` and `/assumptions/{key}` write raw tables, views or `ASSUMPTIONS`. They stay with `ATTENDEE_ROLE` as admin operations; run them with the `hackathon` connection.

## MCP: Claude Desktop with OAuth and a public client

`sql/50_mcp.sql` creates the managed MCP server `CMO_DB.CORE.CMO_MCP`. It exposes `CMO_AGENT` and `FUNNEL_SV`. `CMO_READER` has `USAGE` on it, and Snowflake checks the caller's privileges on every tool.

The security integration `CLAUDE_MCP_OAUTH` already exists. Its settings:

- `OAUTH_CLIENT_TYPE = PUBLIC`: no client secret, so it suits a desktop app that cannot keep one.
- `OAUTH_REDIRECT_URI = https://claude.ai/api/mcp/auth_callback`.
- Refresh tokens valid for 90 days.
- `BLOCKED_ROLES_LIST = (ACCOUNTADMIN, SECURITYADMIN)`.
- `OAUTH_USE_SECONDARY_ROLES = NONE`, so an OAuth session runs with exactly one role and its hierarchy.

To connect Claude Desktop:

1. Get the client id: `DESCRIBE SECURITY INTEGRATION CLAUDE_MCP_OAUTH` → `OAUTH_CLIENT_ID`. A public client has no secret.
2. In Claude Desktop, go to **Settings → Connectors → Add custom connector**. Enter:
   - URL `https://skb54027.snowflakecomputing.com/api/v2/databases/CMO_DB/schemas/CORE/mcp-servers/CMO_MCP`.
   - Under **Advanced settings**, the OAuth client id, with the client secret left empty.
3. Click **Connect**. The browser opens Snowflake's `/oauth/authorize`, you sign in, and Snowflake redirects to the Claude callback.

Snowflake OAuth gives the token the role named in a `session:role:<ROLE>` scope, or else the user's `DEFAULT_ROLE`. For `USER` that default is `ATTENDEE_ROLE`, so a connector that sends no scope runs as the owner. To make the MCP path read-only, do one of these (not applied, because the teammate's current MCP setup depends on the integration):

- **Dedicated MCP user (preferred).** Run as `USERADMIN`:

  ```sql
  CREATE USER CMO_MCP_USER DEFAULT_ROLE = CMO_READER ...; GRANT ROLE CMO_READER TO USER CMO_MCP_USER;
  ```

  Then sign in to the connector as that user.

- **Block the owner role on the integration.** Once nobody needs MCP as owner:

  ```sql
  ALTER SECURITY INTEGRATION CLAUDE_MCP_OAUTH
    SET BLOCKED_ROLES_LIST = ('ACCOUNTADMIN', 'SECURITYADMIN', 'ATTENDEE_ROLE');
  ```

- **Enforce PKCE.** Public clients should use PKCE, and Claude supports it:

  ```sql
  ALTER SECURITY INTEGRATION CLAUDE_MCP_OAUTH SET OAUTH_ENFORCE_PKCE = TRUE;
  ```

Masking applies on the MCP path too. A reader's MCP session sees `***` for the masked columns, including through the CMO agent's `ask_channel` tool.
