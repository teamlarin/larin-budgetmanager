import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getJethrToken,
  jethrFetchAll,
  JETHR_PATHS,
} from "../_shared/jethr.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const DEBUG_VERSION = "2026-05-13.recursive-scan-v1";

// Chiavi che indicano un ID dipendente (scalare) dentro un oggetto annidato
const ID_KEY_HINTS = [
  "id", "pk", "uuid",
  "employee_id", "employeeid", "employeeId",
  "employee_uuid", "employeeUuid",
  "employee_code", "employeeCode", "code",
  "user_id", "userId",
  "person_id", "personId",
  "external_id", "externalId",
];

const NAME_KEY_HINTS = [
  "first_name", "firstName", "given_name", "givenName", "name",
  "last_name", "lastName", "surname", "family_name", "familyName",
  "full_name", "fullName", "display_name", "displayName",
];

const EMAIL_KEY_HINTS = ["email", "work_email", "workEmail", "personal_email"];

function isPlainObject(v: any): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function looksLikeEmployeeObject(o: Record<string, unknown>): boolean {
  const keys = Object.keys(o);
  const hasId = keys.some((k) => ID_KEY_HINTS.includes(k) && (typeof (o as any)[k] === "string" || typeof (o as any)[k] === "number"));
  const hasName = keys.some((k) => NAME_KEY_HINTS.includes(k));
  const hasEmail = keys.some((k) => EMAIL_KEY_HINTS.includes(k));
  return hasId && (hasName || hasEmail);
}

function pickIdFromObject(o: Record<string, unknown>): string {
  for (const k of ID_KEY_HINTS) {
    const v = (o as any)[k];
    if (v !== undefined && v !== null && (typeof v === "string" || typeof v === "number")) {
      return String(v);
    }
  }
  return "";
}

function pickName(o: Record<string, unknown>) {
  const first = (o as any).first_name ?? (o as any).firstName ?? (o as any).given_name ?? (o as any).givenName ?? "";
  const last = (o as any).last_name ?? (o as any).lastName ?? (o as any).surname ?? (o as any).family_name ?? (o as any).familyName ?? "";
  const full: string = (o as any).full_name ?? (o as any).fullName ?? (o as any).display_name ?? (o as any).displayName ?? (o as any).name ?? "";
  return { first, last, full };
}

function normalizeEmployee(e: any) {
  const id = e.id ?? e.employee_id ?? e.employeeId ?? e.uuid ?? e.pk ?? e.user_id ?? e.userId ?? e.code ?? "";
  const first = e.first_name ?? e.firstName ?? e.name ?? e.given_name ?? e.givenName ?? e.user?.first_name ?? e.user?.firstName ?? "";
  const last = e.last_name ?? e.lastName ?? e.surname ?? e.family_name ?? e.familyName ?? e.user?.last_name ?? e.user?.lastName ?? "";
  const fullName: string = e.full_name ?? e.fullName ?? e.display_name ?? e.displayName ?? e.user?.full_name ?? e.user?.fullName ?? "";
  return {
    id: String(id ?? ""),
    first_name: first || (fullName ? fullName.split(" ")[0] : String(id ?? "")),
    last_name: last || (fullName ? fullName.split(" ").slice(1).join(" ") : ""),
    email: e.email ?? e.work_email ?? e.personal_email ?? e.workEmail ?? e.user?.email ?? null,
    fiscal_code: e.fiscal_code ?? e.tax_code ?? e.codice_fiscale ?? e.fiscalCode ?? null,
    role: e.job_title ?? e.role ?? e.position ?? e.jobTitle ?? null,
  };
}

// Scansione ricorsiva: trova tutti gli oggetti che assomigliano a un dipendente
// e ritorna le loro normalizzazioni + i path JSON dove sono stati trovati.
function scanForEmployees(root: any, maxDepth = 6) {
  const found: { path: string; norm: ReturnType<typeof normalizeEmployee> }[] = [];
  const candidatePaths = new Set<string>();

  function walk(node: any, path: string, depth: number) {
    if (depth > maxDepth || node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length && i < 50; i++) {
        walk(node[i], `${path}[${i}]`, depth + 1);
      }
      return;
    }
    if (!isPlainObject(node)) return;

    if (looksLikeEmployeeObject(node)) {
      const norm = normalizeEmployee(node);
      if (norm.id) {
        found.push({ path: path || "$", norm });
        candidatePaths.add(path || "$");
      }
    }
    // Cerca anche ID scalari "employee_id"/"user_id" a questo livello
    for (const k of Object.keys(node)) {
      if (ID_KEY_HINTS.includes(k) && k !== "id" && k !== "pk" && k !== "uuid" && k !== "code") {
        const v = (node as any)[k];
        if (typeof v === "string" || typeof v === "number") {
          candidatePaths.add(`${path}.${k}`);
        }
      }
      walk((node as any)[k], path ? `${path}.${k}` : k, depth + 1);
    }
  }

  walk(root, "", 0);
  return { found, candidatePaths: Array.from(candidatePaths).slice(0, 40) };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (!userData?.user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = getJethrToken();

    // DEBUG: chiamata raw a Jethr per ispezionare la risposta originale
    const debugUrl = new URL(JETHR_PATHS.employees, "https://backend.jethr.com");
    debugUrl.searchParams.set("limit", "5");
    const rawRes = await fetch(debugUrl.toString(), {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    const rawText = await rawRes.text();
    let rawJson: unknown = null;
    try { rawJson = JSON.parse(rawText); } catch { /* keep as text */ }
    console.log(`[jethr-list-employees v=${DEBUG_VERSION}] direct fetch status=${rawRes.status} body=`, rawText.slice(0, 1000));

    const raw = await jethrFetchAll(JETHR_PATHS.employees, token);
    console.log(`[jethr-list-employees] raw count=${raw.length}, sample=`, raw[0] ? JSON.stringify(raw[0]).slice(0, 500) : "none");
    let employees = raw.map(normalizeEmployee).filter((e) => e.id);

    let fallbackRaw: any[] = [];
    let fallbackSample: any = null;
    let candidatePaths: string[] = [];
    let scanFoundCount = 0;

    if (employees.length === 0) {
      fallbackRaw = await jethrFetchAll(JETHR_PATHS.absences, token);
      fallbackSample = fallbackRaw[0] ?? null;

      const byId = new Map<string, ReturnType<typeof normalizeEmployee>>();
      const allCandidates = new Set<string>();

      for (const req of fallbackRaw) {
        const { found, candidatePaths: cp } = scanForEmployees(req);
        for (const p of cp) allCandidates.add(p);
        for (const f of found) {
          if (f.norm.id && !byId.has(f.norm.id)) byId.set(f.norm.id, f.norm);
        }
      }
      employees = Array.from(byId.values());
      candidatePaths = Array.from(allCandidates).slice(0, 40);
      scanFoundCount = employees.length;

      console.log(
        `[jethr-list-employees] fallback from absences: raw=${fallbackRaw.length}, employees=${employees.length}, candidatePaths=${candidatePaths.length}, sample=`,
        fallbackSample ? JSON.stringify(fallbackSample).slice(0, 800) : "none",
      );
    }

    console.log(`[jethr-list-employees] normalized count=${employees.length}`);

    return new Response(JSON.stringify({
      debug_version: DEBUG_VERSION,
      employees,
      raw_count: raw.length,
      sample: raw[0] ?? null,
      fallback_source: raw.length === 0 && fallbackRaw.length > 0 ? "presence-absence-requests" : null,
      fallback_raw_count: fallbackRaw.length,
      fallback_sample: fallbackSample,
      fallback_candidate_paths: candidatePaths,
      fallback_scan_employees: scanFoundCount,
      debug: {
        status: rawRes.status,
        body_preview: rawText.slice(0, 2000),
        json_keys: rawJson && typeof rawJson === "object" && !Array.isArray(rawJson)
          ? Object.keys(rawJson as Record<string, unknown>)
          : null,
        is_array: Array.isArray(rawJson),
        array_length: Array.isArray(rawJson) ? (rawJson as unknown[]).length : null,
      },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
