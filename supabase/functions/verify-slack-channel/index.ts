import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

interface VerifyResult {
  ok: boolean;
  code?:
    | "slack_not_connected"
    | "channel_not_found"
    | "not_in_channel"
    | "missing_scope"
    | "channel_archived"
    | "slack_api_error"
    | "no_channel_linked"
    | "invalid_request";
  message?: string;
  slack_error?: string;
  channel?: {
    id: string;
    name: string;
    is_private: boolean;
    is_archived: boolean;
    is_member: boolean;
  };
}

const respond = (status: number, body: VerifyResult) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return respond(401, { ok: false, message: "Unauthorized" });
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
      return respond(401, { ok: false, message: "Unauthorized" });
    }

    const body = await req.json().catch(() => ({}));
    const channelId = (body?.channel_id as string | undefined)?.trim();
    if (!channelId) {
      return respond(400, {
        ok: false,
        code: "no_channel_linked",
        message: "Nessun canale Slack collegato",
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!LOVABLE_API_KEY) {
      return respond(500, {
        ok: false,
        code: "slack_api_error",
        message: "LOVABLE_API_KEY non configurato",
      });
    }
    if (!SLACK_API_KEY) {
      return respond(200, {
        ok: false,
        code: "slack_not_connected",
        message:
          "Slack non collegato. Vai su Connettori per collegare Slack al workspace.",
      });
    }

    // 1) conversations.info — verify channel exists and is accessible
    const infoRes = await fetch(
      `${GATEWAY_URL}/conversations.info?channel=${encodeURIComponent(channelId)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": SLACK_API_KEY,
        },
      },
    );
    const infoData = await infoRes.json();

    if (!infoRes.ok || infoData.ok === false) {
      const slackErr = infoData?.error || `HTTP ${infoRes.status}`;
      console.error("verify-slack-channel info error:", slackErr, infoData);

      if (slackErr === "channel_not_found") {
        return respond(200, {
          ok: false,
          code: "channel_not_found",
          slack_error: slackErr,
          message:
            "Il canale non esiste più o non è accessibile. Collega un altro canale.",
        });
      }
      if (slackErr === "missing_scope" || slackErr === "not_authed") {
        return respond(200, {
          ok: false,
          code: "missing_scope",
          slack_error: slackErr,
          message:
            "Permessi Slack insufficienti. Aggiungi gli scope `channels:read`, `groups:read`, `channels:history`, `groups:history` da Connettori.",
        });
      }
      return respond(200, {
        ok: false,
        code: "slack_api_error",
        slack_error: slackErr,
        message: `Errore Slack: ${slackErr}`,
      });
    }

    const ch = infoData.channel || {};
    const result: VerifyResult["channel"] = {
      id: ch.id,
      name: ch.name,
      is_private: !!ch.is_private,
      is_archived: !!ch.is_archived,
      is_member: !!ch.is_member,
    };

    if (result.is_archived) {
      return respond(200, {
        ok: false,
        code: "channel_archived",
        message: `Il canale #${result.name} è archiviato. Collega un altro canale.`,
        channel: result,
      });
    }

    // 2) For private channels, the bot MUST be a member to read history
    if (result.is_private && !result.is_member) {
      return respond(200, {
        ok: false,
        code: "not_in_channel",
        message: `Il bot non è membro di #${result.name}. Invitalo dal canale Slack con \`/invite @Lovable App\`.`,
        channel: result,
      });
    }

    // 3) Lightweight history probe to confirm history scope is granted
    const histRes = await fetch(
      `${GATEWAY_URL}/conversations.history?channel=${encodeURIComponent(channelId)}&limit=1`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": SLACK_API_KEY,
        },
      },
    );
    const histData = await histRes.json();
    if (!histRes.ok || histData.ok === false) {
      const slackErr = histData?.error || `HTTP ${histRes.status}`;
      console.error("verify-slack-channel history error:", slackErr, histData);

      if (slackErr === "missing_scope") {
        return respond(200, {
          ok: false,
          code: "missing_scope",
          slack_error: slackErr,
          message:
            "Manca lo scope di lettura cronologia. Aggiungi `channels:history` / `groups:history` da Connettori.",
          channel: result,
        });
      }
      if (slackErr === "not_in_channel") {
        return respond(200, {
          ok: false,
          code: "not_in_channel",
          slack_error: slackErr,
          message: `Il bot non è membro di #${result.name}. Invitalo dal canale Slack con \`/invite @Lovable App\`.`,
          channel: result,
        });
      }
      return respond(200, {
        ok: false,
        code: "slack_api_error",
        slack_error: slackErr,
        message: `Errore Slack: ${slackErr}`,
        channel: result,
      });
    }

    return respond(200, { ok: true, channel: result });
  } catch (err: any) {
    console.error("verify-slack-channel error:", err);
    return respond(500, {
      ok: false,
      code: "slack_api_error",
      message: err?.message || "Unknown error",
    });
  }
};

serve(handler);
