# Barnum frontend

Next.js 15 app: the CEO's weekly memo from the CMO agent, the objectives-to-actions map, the numbers it watches,
goals and limits, and Ask the CMO. Server routes under `src/app/api/companies` sit between the UI and the data.

- `CMO_PROVIDER=cmo-api` + `CMO_API_URL`: adds the live company from the FastAPI backend (`../backend/app/main.py`).
- `CMO_PROVIDER=mock` (default): sample companies only.
- Companies created in the UI are stored in `.data/companies.json` (git-ignored).

`CONTRACT.md` describes the data model, `INTEGRATION.md` the backend mapping, `DEMO.md` the pitch, `video/` the 60-second video (separate npm project).
