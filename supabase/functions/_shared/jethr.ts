// Helper condiviso per chiamate API Jethr (HRIS)
// Documentazione: https://api-doc.jethr.com/reference
//
// NOTA: i path API sotto sono basati su convenzioni REST standard.
// Verificare contro la documentazione ufficiale Jethr (richiede login)
// e adattare se necessario. Centralizzati qui per facilità di modifica.

export const JETHR_BASE_URL = "https://backend.jethr.com";

export const JETHR_PATHS = {
  employees: "/public-api/v1/employees/",
  // Jethr usa un unico endpoint per richieste di presenza/assenza (ferie, permessi, malattia, ecc.)
  absences: "/public-api/v1/presence-absence-requests/",
  absencesPending: "/public-api/v1/presence-absence-requests/?status=pending",
  // L'API Jethr non espone le festività: gestite localmente o non sincronizzate.
  holidays: null as string | null,
};

export interface JethrFetchOptions {
  method?: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
}

export class JethrError extends Error {
  status: number;
  body: string;
  constructor(message: string, status: number, body: string) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

export async function jethrFetch<T = any>(
  path: string,
  token: string,
  opts: JethrFetchOptions = {},
): Promise<T> {
  // path può essere assoluto (URL completo restituito da `next`) o relativo
  const url = /^https?:\/\//i.test(path)
    ? new URL(path)
    : new URL(path, JETHR_BASE_URL);
  if (opts.query) {
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        method: opts.method ?? "GET",
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      });
      const text = await res.text();
      if (!res.ok) {
        if ((res.status === 429 || res.status >= 500) && attempt < 2) {
          await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
          continue;
        }
        throw new JethrError(
          `Jethr ${res.status} on ${path} :: ${text.slice(0, 300)}`,
          res.status,
          text.slice(0, 500),
        );
      }
      return text ? JSON.parse(text) : ({} as T);
    } catch (err) {
      lastErr = err;
      if (attempt === 2) throw err;
      await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
    }
  }
  throw lastErr;
}

// Pagina rilevando automaticamente lo schema di risposta:
// - array semplice
// - { data|results|items|... : [...] } con `next` come URL completo (stile DRF)
// - paginazione page-based con `page`/`count`
export async function jethrFetchAll<T = any>(
  path: string,
  token: string,
  query: Record<string, string | number | undefined> = {},
): Promise<T[]> {
  const all: T[] = [];
  let nextUrl: string | null = null;
  let pageNum: number | null = null;
  let pageGuard = 0;

  while (pageGuard < 50) {
    let res: any;
    if (nextUrl) {
      // Segui l'URL completo restituito da Jethr (no query extra: già contiene cursor/page)
      res = await jethrFetch<any>(nextUrl, token);
    } else {
      const q: Record<string, string | number | undefined> = {
        ...query,
        limit: 100,
        ...(pageNum !== null ? { page: pageNum } : {}),
      };
      res = await jethrFetch<any>(path, token, { query: q });
    }

    let pageItems: any[] | null = null;
    if (Array.isArray(res)) {
      pageItems = res;
    } else if (res && typeof res === "object") {
      for (const key of ["data", "results", "items", "employees", "requests", "records"]) {
        if (Array.isArray(res[key])) { pageItems = res[key]; break; }
      }
      if (!pageItems) {
        for (const v of Object.values(res)) {
          if (Array.isArray(v)) { pageItems = v as any[]; break; }
        }
      }
    }
    if (!pageItems) {
      console.warn(`[jethr] Unexpected response shape on ${path}:`, JSON.stringify(res).slice(0, 300));
      break;
    }
    all.push(...pageItems);

    const next = res?.next ?? res?.next_page ?? res?.next_cursor ?? null;
    if (typeof next === "string" && /^https?:\/\//i.test(next)) {
      nextUrl = next;
    } else if (typeof next === "string" && next.length > 0) {
      // Cursor opaco → usa come query param `cursor`
      nextUrl = null;
      query = { ...query, cursor: next };
    } else if (pageItems.length === 100 && (typeof res?.page === "number" || typeof res?.count === "number")) {
      nextUrl = null;
      pageNum = (typeof res?.page === "number" ? res.page : (pageNum ?? 1)) + 1;
    } else {
      break;
    }
    pageGuard++;
  }
  return all;
}

export function getJethrToken(): string {
  const t = Deno.env.get("JETHR_API_TOKEN");
  if (!t) throw new Error("JETHR_API_TOKEN non configurato");
  return t;
}

export interface NormalizedJethrEmployee {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  fiscal_code: string | null;
  role: string | null;
  source?: string;
  source_path?: string;
}

const JETHR_ID_KEY_HINTS = [
  "id", "pk", "uuid",
  "employee_id", "employeeid", "employeeId",
  "employee_uuid", "employeeUuid",
  "employee_code", "employeeCode",
  "user_id", "userId",
  "person_id", "personId",
  "external_id", "externalId",
];

const JETHR_NAME_KEY_HINTS = [
  "first_name", "firstName", "given_name", "givenName", "name",
  "last_name", "lastName", "surname", "family_name", "familyName",
  "full_name", "fullName", "display_name", "displayName",
];

const JETHR_EMAIL_KEY_HINTS = ["email", "work_email", "workEmail", "personal_email"];

function isObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function scalar(v: unknown): string {
  return typeof v === "string" || typeof v === "number" ? String(v) : "";
}

function looksEmployeeScoped(path: string, key: string): boolean {
  const s = `${path}.${key}`.toLowerCase();
  return /employee|dipendent|person|user|collaborator/.test(s);
}

function pickNameParts(o: any) {
  const first = o?.first_name ?? o?.firstName ?? o?.given_name ?? o?.givenName ?? o?.user?.first_name ?? o?.user?.firstName ?? "";
  const last = o?.last_name ?? o?.lastName ?? o?.surname ?? o?.family_name ?? o?.familyName ?? o?.user?.last_name ?? o?.user?.lastName ?? "";
  const full: string = o?.full_name ?? o?.fullName ?? o?.display_name ?? o?.displayName ?? o?.employee_name ?? o?.employeeName ?? o?.user?.full_name ?? o?.user?.fullName ?? o?.name ?? "";
  return { first: String(first || ""), last: String(last || ""), full: String(full || "") };
}

export function normalizeJethrEmployee(e: any, fallbackId = "", sourcePath = ""): NormalizedJethrEmployee {
  const id = e?.id ?? e?.employee_id ?? e?.employeeId ?? e?.uuid ?? e?.pk ?? e?.user_id ?? e?.userId ?? e?.code ?? fallbackId ?? "";
  const { first, last, full } = pickNameParts(e);
  const fullFirst = full ? full.split(" ")[0] : "";
  const fullLast = full ? full.split(" ").slice(1).join(" ") : "";
  const normalizedId = String(id ?? "");
  return {
    id: normalizedId,
    first_name: first || fullFirst || "Dipendente Jethr",
    last_name: last || fullLast || (normalizedId ? `ID ${normalizedId}` : ""),
    email: e?.email ?? e?.work_email ?? e?.personal_email ?? e?.workEmail ?? e?.user?.email ?? null,
    fiscal_code: e?.fiscal_code ?? e?.tax_code ?? e?.codice_fiscale ?? e?.fiscalCode ?? null,
    role: e?.job_title ?? e?.role ?? e?.position ?? e?.jobTitle ?? null,
    source: sourcePath ? "presence-absence-requests" : undefined,
    source_path: sourcePath || undefined,
  };
}

export function scanForJethrEmployees(root: any, maxDepth = 7) {
  const found: { path: string; norm: NormalizedJethrEmployee }[] = [];
  const candidatePaths = new Set<string>();
  const seen = new Set<string>();

  function add(path: string, node: any, id: string) {
    if (!id || seen.has(id)) return;
    seen.add(id);
    candidatePaths.add(path || "$.");
    found.push({ path: path || "$", norm: normalizeJethrEmployee(isObject(node) ? node : {}, id, path || "$") });
  }

  function walk(node: any, path: string, depth: number) {
    if (depth > maxDepth || node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length && i < 50; i++) walk(node[i], `${path}[${i}]`, depth + 1);
      return;
    }
    if (!isObject(node)) return;

    const keys = Object.keys(node);
    const hasName = keys.some((k) => JETHR_NAME_KEY_HINTS.includes(k));
    const hasEmail = keys.some((k) => JETHR_EMAIL_KEY_HINTS.includes(k));
    const idKey = JETHR_ID_KEY_HINTS.find((k) => scalar((node as any)[k]));
    if (idKey && (hasName || hasEmail || looksEmployeeScoped(path, idKey))) {
      add(path || idKey, node, scalar((node as any)[idKey]));
    }

    for (const key of keys) {
      const nextPath = path ? `${path}.${key}` : key;
      const value = (node as any)[key];
      const valueId = scalar(value);
      if (valueId && JETHR_ID_KEY_HINTS.includes(key) && looksEmployeeScoped(path, key)) {
        candidatePaths.add(nextPath);
        add(nextPath, node, valueId);
      }
      walk(value, nextPath, depth + 1);
    }
  }

  walk(root, "", 0);
  return { found, candidatePaths: Array.from(candidatePaths).slice(0, 80) };
}

export function extractJethrEmployeeIdFromRequest(req: any): string {
  const direct = scalar(req?.employee_id ?? req?.employeeId ?? req?.employee_uuid ?? req?.employeeUuid ?? req?.employee_code ?? req?.employeeCode);
  if (direct) return direct;
  const nested = scalar(req?.employee?.id ?? req?.employee?.uuid ?? req?.employee?.code ?? req?.employee?.pk ?? req?.employee?.employee_id ?? req?.employee?.employeeId);
  if (nested) return nested;
  const user = scalar(req?.user_id ?? req?.userId ?? req?.user?.id ?? req?.user?.uuid ?? req?.user?.pk);
  if (user) return user;
  const person = scalar(req?.person_id ?? req?.personId ?? req?.person?.id ?? req?.person?.uuid ?? req?.person?.pk);
  if (person) return person;
  const { found } = scanForJethrEmployees(req, 7);
  return found[0]?.norm?.id ?? "";
}
