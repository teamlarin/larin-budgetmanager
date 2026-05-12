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
