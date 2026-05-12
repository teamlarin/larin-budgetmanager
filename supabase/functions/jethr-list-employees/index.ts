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

// Estrae campi standard da un record dipendente Jethr,
// tollerante a varianti di naming.
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

function employeeFromRequest(r: any) {
  const embedded = r.employee ?? r.user ?? r.person ?? r.requester ?? null;
  if (embedded && typeof embedded === "object") {
    return normalizeEmployee({
      ...embedded,
      id: embedded.id ?? embedded.employee_id ?? embedded.uuid ?? embedded.code ?? r.employee_id ?? r.user_id,
    });
  }
  return normalizeEmployee({
    id: r.employee_id ?? r.employeeId ?? r.user_id ?? r.userId ?? "",
    first_name: r.employee_first_name ?? r.employeeFirstName ?? r.first_name,
    last_name: r.employee_last_name ?? r.employeeLastName ?? r.last_name,
    full_name: r.employee_name ?? r.employeeName ?? r.full_name,
    email: r.employee_email ?? r.employeeEmail ?? r.email,
  });
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
    console.log(`[jethr-list-employees] direct fetch status=${rawRes.status} body=`, rawText.slice(0, 1000));

    const raw = await jethrFetchAll(JETHR_PATHS.employees, token);
    console.log(`[jethr-list-employees] raw count=${raw.length}, sample=`, raw[0] ? JSON.stringify(raw[0]).slice(0, 500) : "none");
    let employees = raw.map(normalizeEmployee).filter((e) => e.id);

    let fallbackRaw: any[] = [];
    if (employees.length === 0) {
      fallbackRaw = await jethrFetchAll(JETHR_PATHS.absences, token);
      const byId = new Map<string, ReturnType<typeof normalizeEmployee>>();
      for (const req of fallbackRaw) {
        const employee = employeeFromRequest(req);
        if (employee.id && !byId.has(employee.id)) byId.set(employee.id, employee);
      }
      employees = Array.from(byId.values());
      console.log(`[jethr-list-employees] fallback from absences: raw=${fallbackRaw.length}, employees=${employees.length}`);
    }

    console.log(`[jethr-list-employees] normalized count=${employees.length}`);

    return new Response(JSON.stringify({
      employees,
      raw_count: raw.length,
      sample: raw[0] ?? null,
      fallback_source: raw.length === 0 && employees.length > 0 ? "presence-absence-requests" : null,
      fallback_raw_count: fallbackRaw.length,
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
