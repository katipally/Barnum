// Company registry: provider samples (read-only) + user-created companies persisted to .data/companies.json.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CaseData, CaseId, CaseSummary, CompanyInput } from "@/lib/types";
import { toSummary } from "./brief";
import { HttpError } from "./errors";
import { getProvider } from "./provider";
import { STAGES, UNITS, buildCompany } from "./templates";

interface StoredCompany {
  input: CompanyInput;
  createdAt: string;
  data: CaseData; // template + CEO steering while awaiting data
}

interface RegistryFile {
  version: 1;
  companies: StoredCompany[];
}

const MAX_COMPANIES = 200;

export const dataDir = () => process.env.CMO_DATA_DIR ?? path.join(process.cwd(), ".data");
const registryPath = () => path.join(dataDir(), "companies.json");

const g = globalThis as typeof globalThis & {
  __cmoRegistry?: Promise<Map<CaseId, StoredCompany>>;
  __cmoRegistryWrite?: Promise<void>;
};

async function load(): Promise<Map<CaseId, StoredCompany>> {
  const file = registryPath();
  let raw: string;
  try {
    raw = await readFile(file, "utf8");
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw e;
  }
  try {
    const parsed = JSON.parse(raw) as RegistryFile;
    if (!Array.isArray(parsed.companies)) throw new Error("companies is not an array");
    return new Map(parsed.companies.filter((c) => c?.data?.case?.id).map((c) => [c.data.case.id, c]));
  } catch (e) {
    // Keep the unreadable file aside instead of overwriting it on the next write.
    const aside = `${file}.corrupt-${Date.now()}`;
    console.error(`[companies] ${file} is unreadable (${(e as Error).message}); moved to ${aside}`);
    await rename(file, aside).catch(() => {});
    return new Map();
  }
}

function registry(): Promise<Map<CaseId, StoredCompany>> {
  return (g.__cmoRegistry ??= load().catch((e) => {
    g.__cmoRegistry = undefined;
    throw e;
  }));
}

/** Serialised atomic write: temp file + rename. */
async function save(map: Map<CaseId, StoredCompany>): Promise<void> {
  const body: RegistryFile = { version: 1, companies: [...map.values()] };
  const json = JSON.stringify(body, null, 2);
  const run = async () => {
    const file = registryPath();
    await mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, json, "utf8");
    await rename(tmp, file);
  };
  const next = (g.__cmoRegistryWrite ?? Promise.resolve()).then(run, run);
  g.__cmoRegistryWrite = next.catch(() => {});
  return next;
}

async function sampleSummaries(): Promise<CaseSummary[]> {
  return (await getProvider().listCases()).map((s) => ({ ...s, sample: s.dataStatus !== "connected" }));
}

async function isSample(id: string): Promise<boolean> {
  return (await sampleSummaries()).some((s) => s.id === id);
}

/** User companies first (newest first), then samples. */
export async function listCompanies(): Promise<CaseSummary[]> {
  const users = [...(await registry()).values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((c) => toSummary(c.data));
  return [...users, ...(await sampleSummaries())];
}

export async function companyExists(id: string): Promise<boolean> {
  return (await isSample(id)) || (await registry()).has(id);
}

/** Pristine source data for a company (before in-memory decisions/steering). */
export async function companySource(id: CaseId): Promise<CaseData | undefined> {
  const provider = getProvider();
  if (await isSample(id)) return provider.getCaseData(id);
  const stored = (await registry()).get(id);
  if (!stored) return undefined;
  const live = await provider.getConnectedData?.(stored.data.case);
  if (live) return { ...live, case: { ...live.case, id, name: stored.data.case.name, sample: false, dataStatus: "connected" } };
  return stored.data;
}

export async function createCompany(input: CompanyInput): Promise<CaseData> {
  const samples = await sampleSummaries();
  const map = await registry();
  // No await between picking the slug and claiming it, so concurrent creates cannot collide.
  if (map.size >= MAX_COMPANIES) throw new HttpError(409, `At most ${MAX_COMPANIES} companies can be created`);
  const taken = [...map.keys(), ...samples.map((s) => s.id)];
  const data = buildCompany(input, taken);
  map.set(data.case.id, { input, createdAt: new Date().toISOString(), data });
  await save(map);
  return data;
}

export async function deleteCompany(id: CaseId): Promise<void> {
  if (await isSample(id)) throw new HttpError(403, "Sample companies cannot be deleted");
  const map = await registry();
  if (!map.delete(id)) throw new HttpError(404, `Unknown company: ${id}`);
  await save(map);
}

/** Persists the working copy of a user company while it is still template data (connected data lives at the source). */
export async function persistCompany(data: CaseData): Promise<void> {
  if (data.case.dataStatus !== "awaiting_data") return;
  const map = await registry();
  const stored = map.get(data.case.id);
  if (!stored) return;
  stored.data = structuredClone(data);
  await save(map);
}

/** Rebuilds a user company's template from its onboarding input (drops steering). No-op for samples. */
export async function resetCompanyTemplate(id: CaseId): Promise<void> {
  const map = await registry();
  const stored = map.get(id);
  if (!stored) return;
  const fresh = buildCompany(stored.input);
  stored.data = { ...fresh, case: { ...fresh.case, id } };
  await save(map);
}

// ---- Input validation ----

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function text(errors: string[], v: unknown, field: string, max: number, required = true): string | undefined {
  if (v === undefined || v === null || (typeof v === "string" && !v.trim())) {
    if (required) errors.push(`${field} is required`);
    return undefined;
  }
  if (typeof v !== "string") {
    errors.push(`${field} must be a string`);
    return undefined;
  }
  const s = v.trim().replace(/\s+/g, " ");
  if (s.length > max) errors.push(`${field} must be at most ${max} characters`);
  return s;
}

function num(errors: string[], v: unknown, field: string, min: number, max: number, integer = false): number {
  if (!isNum(v)) {
    errors.push(`${field} must be a number`);
    return NaN;
  }
  if (integer && !Number.isInteger(v)) errors.push(`${field} must be a whole number`);
  if (v < min || v > max) errors.push(`${field} must be between ${min} and ${max}`);
  return v;
}

function website(errors: string[], v: unknown): string | undefined {
  const s = text(errors, v, "website", 200, false);
  if (!s) return undefined;
  try {
    const url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".") || /\s/.test(s)) throw new Error();
    return url.href.replace(/\/$/, "");
  } catch {
    errors.push("website must be a URL or domain, e.g. example.com");
    return undefined;
  }
}

function isoDate(errors: string[], v: unknown, field: string): string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(`${v}T00:00:00Z`)) ||
    new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) !== v) {
    errors.push(`${field} must be a date in YYYY-MM-DD format`);
    return "";
  }
  return v;
}

/** Validates and normalises a CompanyInput; throws 400 listing every problem. */
export function parseCompanyInput(body: unknown): CompanyInput {
  if (typeof body !== "object" || body === null || Array.isArray(body)) throw new HttpError(400, "Body must be a CompanyInput object");
  const b = body as Record<string, unknown>;
  const errors: string[] = [];

  const name = text(errors, b.name, "name", 80);
  const tagline = text(errors, b.tagline, "tagline", 160);
  const industry = text(errors, b.industry, "industry", 80);
  const periodLabel = text(errors, b.periodLabel, "periodLabel", 40);
  const site = website(errors, b.website);
  const stage = b.stage as CompanyInput["stage"];
  if (!STAGES.includes(stage)) errors.push(`stage must be one of ${STAGES.join(", ")}`);
  const weeksInPeriod = num(errors, b.weeksInPeriod, "weeksInPeriod", 1, 53, true);
  const week = num(errors, b.week, "week", 1, isNum(weeksInPeriod) ? weeksInPeriod : 53, true);
  const budgetTotal = num(errors, b.budgetTotal, "budgetTotal", 0, 1e12);
  const autonomyPct = num(errors, b.autonomyPct, "autonomyPct", 0, 100);

  let topGoal = {} as CompanyInput["topGoal"];
  const t = b.topGoal;
  if (typeof t !== "object" || t === null || Array.isArray(t)) errors.push("topGoal is required");
  else {
    const tg = t as Record<string, unknown>;
    const unit = tg.unit as CompanyInput["topGoal"]["unit"];
    if (!UNITS.includes(unit)) errors.push(`topGoal.unit must be one of ${UNITS.join(", ")}`);
    const target = num(errors, tg.target, "topGoal.target", 0, 1e13);
    if (target === 0) errors.push("topGoal.target must be greater than 0");
    if (unit === "pct" && target > 100) errors.push("topGoal.target must be at most 100 for a percentage");
    topGoal = {
      label: text(errors, tg.label, "topGoal.label", 80) ?? "",
      target,
      current: num(errors, tg.current, "topGoal.current", 0, 1e13),
      unit,
      deadline: isoDate(errors, tg.deadline, "topGoal.deadline"),
    };
  }

  if (errors.length) throw new HttpError(400, `Invalid company: ${errors.join("; ")}`);
  return {
    name: name!,
    ...(site ? { website: site } : {}),
    tagline: tagline!,
    industry: industry!,
    stage,
    periodLabel: periodLabel!,
    weeksInPeriod,
    week,
    topGoal,
    budgetTotal,
    autonomyPct,
  };
}
