import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getProjectResidualMargin } from "../_shared/residual-margin.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SlackNotificationRequest {
  type?: "progress_update" | "project_completed" | "project_opened" | "project_interrupted";
  project_id?: string;
  project_name: string;
  progress?: number;
  update_text?: string;
  roadblocks_text?: string;
  health_status?: "in_linea" | "attenzione" | "bloccato";
  health_label?: string;
  open_roadblocks?: string[];
  user_name?: string;
  client_name?: string;
  project_leader_name?: string;
  account_name?: string;
  quote_number?: string;
  residual_margin?: number;
  discipline?: string;
  start_date?: string;
  end_date?: string;
  actual_end_date?: string;
  team_members?: string[];
}

const HEALTH_EMOJI: Record<string, string> = {
  in_linea: "🟢",
  attenzione: "🟡",
  bloccato: "🔴",
};

const HEALTH_FALLBACK_LABEL: Record<string, string> = {
  in_linea: "In linea",
  attenzione: "Con attenzione",
  bloccato: "Bloccato",
};

function parseDateOnly(value?: string): { year: number; month: number; day: number } | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { year, month, day };
}

function formatExpectedEndDate(endDate?: string, now = new Date()): string {
  const parsed = parseDateOnly(endDate);
  if (!parsed) return "n.d.";

  const formatted = `${String(parsed.day).padStart(2, "0")}/${String(parsed.month).padStart(2, "0")}/${parsed.year}`;
  const expectedUtc = Date.UTC(parsed.year, parsed.month - 1, parsed.day);
  const todayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const todayValue = Object.fromEntries(todayParts.map((part) => [part.type, part.value]));
  const todayUtc = Date.UTC(Number(todayValue.year), Number(todayValue.month) - 1, Number(todayValue.day));
  const delayDays = Math.floor((todayUtc - expectedUtc) / 86_400_000);

  if (delayDays <= 0) return formatted;
  return `${formatted} · in ritardo di ${delayDays} ${delayDays === 1 ? "giorno" : "giorni"}`;
}

function buildProgressUpdateBlocks(data: SlackNotificationRequest): any[] {
  const healthKey = data.health_status || "in_linea";
  const healthEmoji = HEALTH_EMOJI[healthKey] || "⚪";
  const healthLabel = data.health_label || HEALTH_FALLBACK_LABEL[healthKey] || healthKey;

  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${healthEmoji} ${data.project_name} — ${healthLabel}`,
        emoji: true,
      },
    },
  ];

  const infoFields: any[] = [
    { type: "mrkdwn", text: `*Progresso:*\n${data.progress ?? 0}%` },
    {
      type: "mrkdwn",
      text: `*Margine residuo:*\n${
        typeof data.residual_margin === "number" ? `${data.residual_margin.toFixed(1)}%` : "n.d."
      }`,
    },
    { type: "mrkdwn", text: `*Fine prevista:*\n${formatExpectedEndDate(data.end_date)}` },
  ];
  if (data.client_name) infoFields.push({ type: "mrkdwn", text: `*Cliente:*\n${data.client_name}` });
  if (data.project_leader_name) {
    infoFields.push({ type: "mrkdwn", text: `*Project Leader:*\n${data.project_leader_name}` });
  }
  if (data.account_name) infoFields.push({ type: "mrkdwn", text: `*Account:*\n${data.account_name}` });

  // Slack allows max 10 fields per section: split in chunks of 2
  for (let i = 0; i < infoFields.length; i += 2) {
    blocks.push({ type: "section", fields: infoFields.slice(i, i + 2) });
  }

  if (data.update_text) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Sintesi:*\n${data.update_text}` },
    });
  }

  if (data.open_roadblocks && data.open_roadblocks.length > 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*🚧 Roadblock aperti:*\n${data.open_roadblocks.join("\n")}` },
    });
  } else if (data.roadblocks_text) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*🚧 Roadblocks:*\n${data.roadblocks_text}` },
    });
  }

  return blocks;
}


function formatDateOnly(value?: string): string {
  const parsed = parseDateOnly(value);
  if (!parsed) return "n.d.";
  return `${String(parsed.day).padStart(2, "0")}/${String(parsed.month).padStart(2, "0")}/${parsed.year}`;
}

/** Scostamento tra data di chiusura effettiva e scadenza prevista. */
function formatDeliveryDeviation(endDate?: string, actualEndDate?: string): string | null {
  const expected = parseDateOnly(endDate);
  const actual = parseDateOnly(actualEndDate);
  if (!expected || !actual) return null;
  const expectedUtc = Date.UTC(expected.year, expected.month - 1, expected.day);
  const actualUtc = Date.UTC(actual.year, actual.month - 1, actual.day);
  const diff = Math.floor((actualUtc - expectedUtc) / 86_400_000);
  if (diff > 0) return `🔴 In ritardo di ${diff} ${diff === 1 ? "giorno" : "giorni"}`;
  if (diff === 0) return "🟢 Consegnato in tempo";
  const early = Math.abs(diff);
  return `🟢 Consegnato in tempo (${early} ${early === 1 ? "giorno" : "giorni"} in anticipo)`;
}

function buildClosureBlocks(data: SlackNotificationRequest, interrupted: boolean): any[] {
  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: interrupted ? `🛑 Progetto Interrotto` : `✅ Progetto Completato`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Progetto:*\n${data.project_name}` },
        ...(data.client_name ? [{ type: "mrkdwn", text: `*Cliente:*\n${data.client_name}` }] : []),
      ],
    },
  ];

  const peopleFields: any[] = [];
  if (data.project_leader_name) peopleFields.push({ type: "mrkdwn", text: `*Project Leader:*\n${data.project_leader_name}` });
  if (data.account_name) peopleFields.push({ type: "mrkdwn", text: `*Account:*\n${data.account_name}` });
  if (peopleFields.length > 0) blocks.push({ type: "section", fields: peopleFields });

  blocks.push({
    type: "section",
    fields: [
      { type: "mrkdwn", text: `*Fine prevista:*\n${formatDateOnly(data.end_date)}` },
      {
        type: "mrkdwn",
        text: `*${interrupted ? "Data interruzione" : "Chiusura effettiva"}:*\n${formatDateOnly(data.actual_end_date)}`,
      },
    ],
  });

  if (!interrupted) {
    const deviation = formatDeliveryDeviation(data.end_date, data.actual_end_date);
    if (deviation) {
      blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Puntualità:* ${deviation}` } });
    }
  }

  const extraFields: any[] = [];
  if (data.quote_number) extraFields.push({ type: "mrkdwn", text: `*N. Preventivo:*\n${data.quote_number}` });
  if (typeof data.residual_margin === "number") {
    extraFields.push({ type: "mrkdwn", text: `*Margine Residuo:*\n${data.residual_margin.toFixed(1)}%` });
  }
  if (extraFields.length > 0) blocks.push({ type: "section", fields: extraFields });

  if (interrupted) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `Progetto chiuso in anticipo su richiesta del cliente: progresso registrato ${data.progress ?? 0}%.`,
        },
      ],
    });
  }

  return blocks;
}

function buildProjectOpenedBlocks(data: SlackNotificationRequest): any[] {
  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `🚀 Nuovo Progetto Aperto`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Progetto:*\n${data.project_name}` },
        ...(data.client_name ? [{ type: "mrkdwn", text: `*Cliente:*\n${data.client_name}` }] : []),
      ],
    },
    {
      type: "section",
      fields: [
        ...(data.project_leader_name ? [{ type: "mrkdwn", text: `*Project Leader:*\n${data.project_leader_name}` }] : []),
        ...(data.account_name ? [{ type: "mrkdwn", text: `*Account:*\n${data.account_name}` }] : []),
      ],
    },
  ];

  const extraFields: any[] = [];
  if (data.quote_number) extraFields.push({ type: "mrkdwn", text: `*N. Preventivo:*\n${data.quote_number}` });
  if (data.discipline) extraFields.push({ type: "mrkdwn", text: `*Disciplina:*\n${data.discipline}` });
  if (extraFields.length > 0) {
    blocks.push({ type: "section", fields: extraFields });
  }

  const dateFields: any[] = [];
  if (data.start_date) dateFields.push({ type: "mrkdwn", text: `*Data Inizio:*\n${data.start_date}` });
  if (data.end_date) dateFields.push({ type: "mrkdwn", text: `*Data Fine:*\n${data.end_date}` });
  if (dateFields.length > 0) {
    blocks.push({ type: "section", fields: dateFields });
  }

  if (data.team_members && data.team_members.length > 0) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Team:*\n${data.team_members.join(", ")}` },
    });
  }

  return blocks;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const data: SlackNotificationRequest = await req.json();
    const notificationType = data.type || "progress_update";

    // Recupero server-side della scadenza e calcolo del margine residuo.
    // I valori letti dal progetto prevalgono su quelli eventualmente inviati dal client.
    if (notificationType !== "project_opened") {
      try {
        const admin = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
          { auth: { persistSession: false } },
        );
        let projectId = data.project_id;
        let projectEndDate: string | undefined;
        let projectActualEndDate: string | undefined;
        if (projectId) {
          const { data: p, error: pErr } = await admin
            .from("projects").select("id, end_date, actual_end_date").eq("id", projectId).maybeSingle();
          if (pErr) console.error("Project lookup by id failed:", pErr);
          projectId = p?.id;
          projectEndDate = p?.end_date ?? undefined;
          projectActualEndDate = p?.actual_end_date ?? undefined;
        } else if (data.project_name) {
          const { data: p, error: pErr } = await admin
            .from("projects").select("id, end_date, actual_end_date").eq("name", data.project_name).limit(1).maybeSingle();
          if (pErr) console.error("Project lookup by name failed:", pErr);
          projectId = p?.id;
          projectEndDate = p?.end_date ?? undefined;
          projectActualEndDate = p?.actual_end_date ?? undefined;
        }
        if (projectId) {
          data.end_date = projectEndDate;
          if (projectActualEndDate) data.actual_end_date = projectActualEndDate;
          const m = await getProjectResidualMargin(admin, projectId);
          console.log(`Residual margin for ${projectId}:`, m);
          if (typeof m === "number") data.residual_margin = m;
        } else {
          console.log("Residual margin skipped: project not found", data.project_name);
        }
      } catch (e) {
        console.error("Residual margin error:", e);
      }
    }

    console.log(`Sending Slack notification (${notificationType}) for project:`, data.project_name);

    // Select webhook URL based on notification type
    let webhookUrl: string | undefined;
    if (notificationType === "project_opened") {
      webhookUrl = Deno.env.get("SLACK_WEBHOOK_URL_NEW_PROJECT");
      if (!webhookUrl) {
        throw new Error("SLACK_WEBHOOK_URL_NEW_PROJECT not configured");
      }
    } else {
      webhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
      if (!webhookUrl) {
        throw new Error("SLACK_WEBHOOK_URL not configured");
      }
    }

    let blocks: any[];
    let fallbackText: string;

    if (notificationType === "project_completed") {
      blocks = buildClosureBlocks(data, false);
      fallbackText = `✅ Progetto completato: ${data.project_name}`;
    } else if (notificationType === "project_interrupted") {
      blocks = buildClosureBlocks(data, true);
      fallbackText = `🛑 Progetto interrotto: ${data.project_name}`;
    } else if (notificationType === "project_opened") {
      blocks = buildProjectOpenedBlocks(data);
      fallbackText = `🚀 Nuovo progetto aperto: ${data.project_name}`;
    } else {
      blocks = buildProgressUpdateBlocks(data);
      const hEmoji = HEALTH_EMOJI[data.health_status || "in_linea"] || "⚪";
      const marginTxt = typeof data.residual_margin === "number"
        ? ` · margine ${data.residual_margin.toFixed(0)}%`
        : "";
      fallbackText = `${hEmoji} ${data.project_name} · ${data.progress ?? 0}%${marginTxt}`;
    }


    const slackPayload = { blocks, text: fallbackText };

    const slackResponse = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(slackPayload),
    });

    if (!slackResponse.ok) {
      const errorText = await slackResponse.text();
      throw new Error(`Slack API error: ${slackResponse.status} - ${errorText}`);
    }

    console.log("Slack notification sent successfully");

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending Slack notification:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
