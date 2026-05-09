import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  getJethrToken,
  jethrFetch,
  JETHR_PATHS,
  JethrError,
} from "../_shared/jethr.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: solo admin
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
    const { data: claims } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (!claims?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = getJethrToken();
    const res: any = await jethrFetch(JETHR_PATHS.employees, token, {
      query: { limit: 1 },
    });

    const count = Array.isArray(res)
      ? res.length
      : Array.isArray(res?.data)
      ? (res.total ?? res.data.length)
      : 0;

    return new Response(
      JSON.stringify({ ok: true, message: "Connessione Jethr OK", sample_count: count }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const status = err instanceof JethrError ? err.status : 500;
    const body = err instanceof JethrError ? err.body : String((err as Error).message);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message, jethr_status: status, jethr_body: body }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
