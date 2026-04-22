import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_archived: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
      token,
    );
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const userId = claims.claims.sub as string;

    // Authorization: only specific roles can list channels
    const { data: rolesRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesRows || []).map((r: any) => r.role);
    const allowed = roles.some((r: string) =>
      ["admin", "team_leader", "account", "coordinator"].includes(r)
    );
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        {
          status: 500,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }
    if (!SLACK_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "Slack non collegato. Vai su Connettori per collegare Slack al workspace.",
          code: "slack_not_connected",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const channels: SlackChannel[] = [];
    let cursor = "";
    let pages = 0;
    const MAX_PAGES = 20; // safety: up to ~4k channels

    do {
      const params = new URLSearchParams({
        limit: "200",
        exclude_archived: "true",
        types: "public_channel,private_channel",
      });
      if (cursor) params.set("cursor", cursor);

      const res = await fetch(
        `${GATEWAY_URL}/conversations.list?${params.toString()}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": SLACK_API_KEY,
          },
        },
      );

      const data = await res.json();
      if (!res.ok || data.ok === false) {
        const slackError = data?.error || `HTTP ${res.status}`;
        console.error("Slack conversations.list error:", slackError, data);
        return new Response(
          JSON.stringify({
            error: `Errore Slack: ${slackError}`,
            code: "slack_api_error",
            slack_error: slackError,
          }),
          {
            status: 502,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          },
        );
      }

      for (const c of data.channels || []) {
        channels.push({
          id: c.id,
          name: c.name,
          is_private: !!c.is_private,
          is_archived: !!c.is_archived,
        });
      }

      cursor = data.response_metadata?.next_cursor || "";
      pages += 1;
    } while (cursor && pages < MAX_PAGES);

    channels.sort((a, b) => a.name.localeCompare(b.name));

    return new Response(JSON.stringify({ channels }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("list-slack-channels error:", err);
    return new Response(
      JSON.stringify({ error: err?.message || "Unknown error" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      },
    );
  }
};

serve(handler);
