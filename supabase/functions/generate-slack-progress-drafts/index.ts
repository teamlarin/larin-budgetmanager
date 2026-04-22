import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SLACK_GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
const AI_GATEWAY_URL =
  "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT =
  "Sei un project manager professionale italiano. Devi scrivere progress update settimanali brevi, professionali e concisi (3-4 frasi). Regole tassative: " +
  "(1) NON inventare informazioni che non sono nei messaggi forniti. " +
  "(2) NON menzionare nomi di persone specifiche. " +
  "(3) Scrivi in italiano in tono professionale, niente emoji. " +
  "(4) Concentrati su cosa è stato fatto e cosa è in corso. " +
  "(5) Se i messaggi non danno abbastanza contesto, scrivi un update generico ma onesto e segnala che mancano dettagli.";

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0 = Sun, 1 = Mon
  const diff = (day + 6) % 7; // days since Monday
  d.setUTCDate(d.getUTCDate() - diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function wordCount(text: string): number {
  return (text || "").trim().split(/\s+/).filter(Boolean).length;
}

interface SlackMessage {
  text?: string;
  subtype?: string;
  bot_id?: string;
  user?: string;
  ts?: string;
}

async function fetchSlackMessages(
  channelId: string,
  oldestTs: number,
  lovableKey: string,
  slackKey: string,
): Promise<SlackMessage[]> {
  const messages: SlackMessage[] = [];
  let cursor = "";
  let pages = 0;
  const MAX_PAGES = 5;

  do {
    const params = new URLSearchParams({
      channel: channelId,
      limit: "200",
      oldest: String(oldestTs),
    });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(
      `${SLACK_GATEWAY_URL}/conversations.history?${params.toString()}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": slackKey,
        },
      },
    );

    const data = await res.json();
    if (!res.ok || data.ok === false) {
      throw new Error(
        `Slack history error for ${channelId}: ${data?.error || res.status}`,
      );
    }

    for (const m of data.messages || []) {
      messages.push(m as SlackMessage);
    }

    cursor = data.response_metadata?.next_cursor || "";
    pages += 1;
  } while (cursor && pages < MAX_PAGES);

  return messages;
}

function filterRelevantMessages(
  messages: SlackMessage[],
  minWords = 5,
): string[] {
  return messages
    .filter((m) => !m.subtype && !m.bot_id) // exclude system/bot messages
    .map((m) => (m.text || "").trim())
    .filter((t) => t.length > 0)
    .filter((t) => wordCount(t) >= minWords);
}

async function generateDraft(
  texts: string[],
  lovableKey: string,
  options: { fallbackEmpty?: boolean; lookbackDays?: number } = {},
): Promise<string> {
  const { fallbackEmpty = false, lookbackDays = 7 } = options;

  let userPrompt: string;
  if (fallbackEmpty) {
    userPrompt =
      `Il canale Slack del progetto è stato silente o poco attivo negli ultimi ${lookbackDays} giorni: non ci sono messaggi significativi da cui dedurre lo stato.\n\n` +
      `Scrivi un progress update onesto di 2-3 frasi che segnali esplicitamente la mancanza di aggiornamenti su Slack in questo periodo e suggerisca al PM di integrare manualmente le informazioni mancanti. Tono professionale, italiano, niente emoji.`;
  } else {
    const sample = texts.slice(0, 30).map((t, i) =>
      `${i + 1}. ${t.slice(0, 500)}`
    ).join("\n");
    userPrompt =
      `Ecco i messaggi Slack scambiati negli ultimi ${lookbackDays} giorni sul canale del progetto. Scrivi un progress update di 3-4 frasi.\n\n---\n${sample}\n---`;
  }

  const res = await fetch(AI_GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    if (res.status === 429) {
      throw new Error("AI rate limit");
    }
    if (res.status === 402) {
      throw new Error("AI credits exhausted");
    }
    throw new Error(`AI gateway error ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty AI response");
  return content;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authentication: CRON_SECRET (cron) OR admin user
    const authHeader = req.headers.get("Authorization") || "";
    const cronSecret = Deno.env.get("CRON_SECRET");
    const isCron = !!cronSecret &&
      authHeader === `Bearer ${cronSecret}`;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!isCron) {
      // Manual trigger requires authenticated admin
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const token = authHeader.replace("Bearer ", "");
      const { data: claims } = await userClient.auth.getClaims(token);
      const userId = claims?.claims?.sub as string | undefined;
      if (!userId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
      const { data: roleData } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!LOVABLE_API_KEY || !SLACK_API_KEY) {
      return new Response(
        JSON.stringify({
          error:
            "Slack non collegato o LOVABLE_API_KEY mancante. Collega Slack via Connettori.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    // Optional body: { projectId?, force?, lookbackDays?, minMessages? }
    let body: {
      projectId?: string;
      force?: boolean;
      lookbackDays?: number;
      minMessages?: number;
    } = {};
    if (req.method === "POST") {
      try {
        body = (await req.json()) || {};
      } catch (_) {
        body = {};
      }
    }
    const targetProjectId = body.projectId;
    const force = !!body.force;
    const isManual = !isCron;
    // Manual default: 14d lookback, min 1 msg, 3-word filter. Cron: 7d/3msg/5w.
    const lookbackDays = Math.min(
      Math.max(body.lookbackDays ?? (isManual ? 14 : 7), 1),
      30,
    );
    const minMessages = Math.max(
      body.minMessages ?? (isManual ? 1 : 3),
      0,
    );
    const minWords = isManual ? 3 : 5;

    const now = new Date();
    const weekStart = getMondayOfWeek(now);
    const weekStartStr = toDateOnly(weekStart);
    const oldestTs = Math.floor(
      (now.getTime() - lookbackDays * 24 * 60 * 60 * 1000) / 1000,
    );

    // Fetch eligible projects (filter to single project if targetProjectId set)
    let projectsQuery = supabaseAdmin
      .from("projects")
      .select(
        "id, name, slack_channel_id, slack_channel_name, project_leader_id, status, project_status",
      )
      .not("slack_channel_id", "is", null)
      .eq("status", "approvato");
    if (targetProjectId) {
      projectsQuery = projectsQuery.eq("id", targetProjectId);
    }
    const { data: projects, error: projErr } = await projectsQuery;

    if (projErr) throw projErr;

    const eligibleProjects = (projects || []).filter(
      (p: any) =>
        p.project_status !== "completato" && !!p.slack_channel_id,
    );

    if (targetProjectId && eligibleProjects.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "Progetto non eleggibile: deve essere approvato, non completato e avere un canale Slack collegato.",
        }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

    const stats = {
      week_start: weekStartStr,
      candidates: eligibleProjects.length,
      drafts_created: 0,
      skipped_no_messages: 0,
      skipped_already_updated: 0,
      skipped_existing_draft: 0,
      errors: [] as Array<{ project_id: string; error: string }>,
    };

    for (const project of eligibleProjects) {
      try {
        // Skip if there is already a progress update this week
        const { data: existingUpdate } = await supabaseAdmin
          .from("project_progress_updates")
          .select("id")
          .eq("project_id", project.id)
          .gte("created_at", weekStart.toISOString())
          .limit(1)
          .maybeSingle();
        if (existingUpdate) {
          stats.skipped_already_updated += 1;
          continue;
        }

        // Skip if a pending draft already exists for this week (unless force)
        if (!force) {
          const { data: existingDraft } = await supabaseAdmin
            .from("project_update_drafts")
            .select("id")
            .eq("project_id", project.id)
            .eq("week_start", weekStartStr)
            .eq("status", "pending")
            .limit(1)
            .maybeSingle();
          if (existingDraft) {
            stats.skipped_existing_draft += 1;
            continue;
          }
        }

        // Fetch & filter Slack messages — never persisted
        const rawMessages = await fetchSlackMessages(
          project.slack_channel_id as string,
          oldestTs,
          LOVABLE_API_KEY,
          SLACK_API_KEY,
        );
        const relevant = filterRelevantMessages(rawMessages);

        if (relevant.length < 3) {
          stats.skipped_no_messages += 1;
          continue;
        }

        const draftContent = await generateDraft(relevant, LOVABLE_API_KEY);

        const { data: insertedDraft, error: insErr } = await supabaseAdmin
          .from("project_update_drafts")
          .insert({
            project_id: project.id,
            draft_content: draftContent,
            generated_from: "slack_ai",
            slack_messages_count: relevant.length,
            week_start: weekStartStr,
            status: "pending",
          })
          .select("id")
          .single();
        if (insErr) throw insErr;

        // Notify the project leader (in-app)
        if (project.project_leader_id) {
          await supabaseAdmin.from("notifications").insert({
            user_id: project.project_leader_id,
            type: "progress_draft_ready",
            title: "💡 Bozza Progress Update pronta",
            message: `Ho preparato una bozza del tuo progress update per "${project.name}". Rivedi e pubblica in 30 secondi.`,
            project_id: project.id,
            read: false,
          });
        }

        stats.drafts_created += 1;
      } catch (err: any) {
        console.error(
          `Error processing project ${project.id}:`,
          err?.message || err,
        );
        stats.errors.push({
          project_id: project.id,
          error: err?.message || String(err),
        });
      }
    }

    console.log("generate-slack-progress-drafts stats:", JSON.stringify(stats));

    return new Response(JSON.stringify({ success: true, stats }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("generate-slack-progress-drafts fatal:", err);
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
