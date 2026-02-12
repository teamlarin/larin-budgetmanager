import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SlackNotificationRequest {
  project_name: string;
  progress: number;
  update_text?: string;
  roadblocks_text?: string;
  user_name?: string;
  client_name?: string;
  project_leader_name?: string;
  account_name?: string;
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

    const { project_name, progress, update_text, roadblocks_text, user_name, client_name, project_leader_name, account_name }: SlackNotificationRequest = await req.json();

    console.log("Sending Slack notification for project:", project_name);

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
          { type: "mrkdwn", text: `*Progetto:*\n${project_name}` },
          { type: "mrkdwn", text: `*Progresso:*\n${progress}%` },
        ],
      },
      {
        type: "section",
        fields: [
          ...(client_name ? [{ type: "mrkdwn", text: `*Cliente:*\n${client_name}` }] : []),
          ...(project_leader_name ? [{ type: "mrkdwn", text: `*Project Leader:*\n${project_leader_name}` }] : []),
        ],
      },
      {
        type: "section",
        fields: [
          ...(account_name ? [{ type: "mrkdwn", text: `*Account:*\n${account_name}` }] : []),
          ...(user_name ? [{ type: "mrkdwn", text: `*Aggiornato da:*\n${user_name}` }] : []),
        ],
      },
    ];

    if (update_text) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*Update:*\n${update_text}` },
      });
    }

    if (roadblocks_text) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: `*🚧 Roadblocks:*\n${roadblocks_text}` },
      });
    }

    const slackPayload = {
      blocks,
      text: `Aggiornamento progetto: ${project_name} - ${progress}%`,
    };

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
