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
  return {
    id: String(e.id ?? e.employee_id ?? e.uuid ?? ""),
    first_name: e.first_name ?? e.firstName ?? e.name ?? "",
    last_name: e.last_name ?? e.lastName ?? e.surname ?? "",
    email: e.email ?? e.work_email ?? e.personal_email ?? null,
    fiscal_code: e.fiscal_code ?? e.tax_code ?? e.codice_fiscale ?? null,
    role: e.job_title ?? e.role ?? e.position ?? null,
  };
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
    const raw = await jethrFetchAll(JETHR_PATHS.employees, token);
    const employees = raw.map(normalizeEmployee).filter((e) => e.id);

    return new Response(JSON.stringify({ employees }), {
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
