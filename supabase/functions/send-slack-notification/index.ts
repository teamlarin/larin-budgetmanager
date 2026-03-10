import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SlackNotificationRequest {
  type?: "progress_update" | "project_completed" | "project_opened";
  project_name: string;
  progress?: number;
  update_text?: string;
  roadblocks_text?: string;
  user_name?: string;
  client_name?: string;
  project_leader_name?: string;
  account_name?: string;
  quote_number?: string;
  residual_margin?: number;
  discipline?: string;
  start_date?: string;
  end_date?: string;
  team_members?: string[];
}

function buildProgressUpdateBlocks(data: SlackNotificationRequest): any[] {
  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `📊 Aggiornamento Progetto`,
        emoji: true,
      },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Progetto:*\n${data.project_name}` },
        { type: "mrkdwn", text: `*Progresso:*\n${data.progress ?? 0}%` },
      ],
    },
    {
      type: "section",
      fields: [
        ...(data.client_name ? [{ type: "mrkdwn", text: `*Cliente:*\n${data.client_name}` }] : []),
        ...(data.project_leader_name ? [{ type: "mrkdwn", text: `*Project Leader:*\n${data.project_leader_name}` }] : []),
      ],
    },
    {
      type: "section",
      fields: [
        ...(data.account_name ? [{ type: "mrkdwn", text: `*Account:*\n${data.account_name}` }] : []),
        ...(data.user_name ? [{ type: "mrkdwn", text: `*Aggiornato da:*\n${data.user_name}` }] : []),
      ],
    },
  ];

  if (data.update_text) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*Update:*\n${data.update_text}` },
    });
  }

  if (data.roadblocks_text) {
    blocks.push({
      type: "section",
      text: { type: "mrkdwn", text: `*🚧 Roadblocks:*\n${data.roadblocks_text}` },
    });
  }

  return blocks;
}

function buildProjectCompletedBlocks(data: SlackNotificationRequest): any[] {
  const blocks: any[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `✅ Progetto Completato`,
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
    {
      type: "section",
      fields: [
        ...(data.quote_number ? [{ type: "mrkdwn", text: `*N. Preventivo:*\n${data.quote_number}` }] : []),
        ...(data.residual_margin !== undefined ? [{ type: "mrkdwn", text: `*Margine Residuo:*\n${data.residual_margin.toFixed(1)}%` }] : []),
      ],
    },
  ];

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
    const data: SlackNotificationRequest = await req.json();
    const notificationType = data.type || "progress_update";

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
      blocks = buildProjectCompletedBlocks(data);
      fallbackText = `✅ Progetto completato: ${data.project_name}`;
    } else if (notificationType === "project_opened") {
      blocks = buildProjectOpenedBlocks(data);
      fallbackText = `🚀 Nuovo progetto aperto: ${data.project_name}`;
    } else {
      blocks = buildProgressUpdateBlocks(data);
      fallbackText = `Aggiornamento progetto: ${data.project_name} - ${data.progress ?? 0}%`;
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
