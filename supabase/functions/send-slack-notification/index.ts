import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SlackNotificationRequest {
  type?: "progress_update" | "project_completed";
  project_name: string;
  progress?: number;
  update_text?: string;
  roadblocks_text?: string;
  user_name?: string;
  client_name?: string;
  project_leader_name?: string;
  account_name?: string;
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
  ];

  if (data.user_name) {
    blocks.push({
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Completato da:*\n${data.user_name}` },
      ],
    });
  }

  return blocks;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const webhookUrl = Deno.env.get("SLACK_WEBHOOK_URL");
    if (!webhookUrl) {
      throw new Error("SLACK_WEBHOOK_URL not configured");
    }

    const data: SlackNotificationRequest = await req.json();
    const notificationType = data.type || "progress_update";

    console.log(`Sending Slack notification (${notificationType}) for project:`, data.project_name);

    let blocks: any[];
    let fallbackText: string;

    if (notificationType === "project_completed") {
      blocks = buildProjectCompletedBlocks(data);
      fallbackText = `✅ Progetto completato: ${data.project_name}`;
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
