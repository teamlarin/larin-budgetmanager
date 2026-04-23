import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SLACK_GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
const DRIVE_GATEWAY_URL =
  "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const GMAIL_GATEWAY_URL =
  "https://connector-gateway.lovable.dev/google_mail/gmail/v1";
const AI_GATEWAY_URL =
  "https://ai.gateway.lovable.dev/v1/chat/completions";

const SYSTEM_PROMPT =
  "Sei un project manager professionale italiano. Devi scrivere progress update settimanali brevi, professionali e concisi (3-5 frasi). Regole tassative: " +
  "(1) NON inventare informazioni che non sono nelle fonti fornite. " +
  "(2) NON menzionare nomi di persone specifiche (clienti, collaboratori, mittenti email). " +
  "(3) Scrivi in italiano in tono professionale, niente emoji. " +
  "(4) Concentrati su cosa è stato fatto, decisioni prese, cosa è in corso. " +
  "(5) Dai priorità alle decisioni emerse nelle riunioni (trascrizioni Meet), poi integra con email e messaggi Slack. " +
  "(6) Se le fonti non danno abbastanza contesto, scrivi un update generico ma onesto e segnala che mancano dettagli.";

function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = (day + 6) % 7;
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

// =================== SLACK ===================

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

    for (const m of data.messages || []) messages.push(m as SlackMessage);

    cursor = data.response_metadata?.next_cursor || "";
    pages += 1;
  } while (cursor && pages < MAX_PAGES);

  return messages;
}

function filterRelevantSlack(messages: SlackMessage[], minWords = 5): string[] {
  return messages
    .filter((m) => !m.subtype && !m.bot_id)
    .map((m) => (m.text || "").trim())
    .filter((t) => t.length > 0)
    .filter((t) => wordCount(t) >= minWords);
}

// =================== GOOGLE DRIVE / MEET TRANSCRIPTS ===================

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  parents?: string[];
}

interface DriveTranscript {
  title: string;
  text: string;
}

const TRANSCRIPT_NAME_REGEX =
  /(transcript|trascriz|trascriz?ione|meet|recording|registrazione|riunione|appunti)/i;

async function listDriveDocsInFolder(
  folderId: string,
  modifiedSinceIso: string,
  lovableKey: string,
  driveKey: string,
  depth = 0,
  maxDepth = 2,
): Promise<DriveFile[]> {
  if (depth > maxDepth) return [];

  const params = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields:
      "files(id,name,mimeType,modifiedTime,parents),nextPageToken",
    pageSize: "200",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });

  const res = await fetch(`${DRIVE_GATEWAY_URL}/files?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": driveKey,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Drive list error [${res.status}]: ${text.slice(0, 200)}`);
  }

  const data = await res.json();
  const files: DriveFile[] = data.files || [];
  const docs: DriveFile[] = [];
  const subfolders: DriveFile[] = [];

  for (const f of files) {
    if (f.mimeType === "application/vnd.google-apps.folder") {
      subfolders.push(f);
    } else if (
      f.mimeType === "application/vnd.google-apps.document" &&
      (!modifiedSinceIso ||
        !f.modifiedTime ||
        f.modifiedTime >= modifiedSinceIso)
    ) {
      docs.push(f);
    }
  }

  // Recurse into subfolders
  for (const sub of subfolders) {
    try {
      const childDocs = await listDriveDocsInFolder(
        sub.id,
        modifiedSinceIso,
        lovableKey,
        driveKey,
        depth + 1,
        maxDepth,
      );
      docs.push(...childDocs);
    } catch (err) {
      console.warn(`Drive subfolder ${sub.id} error:`, (err as Error).message);
    }
  }

  return docs;
}

async function exportDriveDocAsText(
  fileId: string,
  lovableKey: string,
  driveKey: string,
  maxChars = 8000,
): Promise<string> {
  const res = await fetch(
    `${DRIVE_GATEWAY_URL}/files/${fileId}/export?mimeType=text/plain`,
    {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": driveKey,
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Drive export error [${res.status}] for ${fileId}`);
  }

  const text = await res.text();
  return text.slice(0, maxChars);
}

async function fetchDriveTranscripts(
  folderIds: string[],
  modifiedSinceIso: string,
  lovableKey: string,
  driveKey: string,
  maxTranscripts = 5,
): Promise<DriveTranscript[]> {
  const seenIds = new Set<string>();
  const allDocs: DriveFile[] = [];

  for (const folderId of folderIds) {
    if (!folderId) continue;
    try {
      const docs = await listDriveDocsInFolder(
        folderId,
        modifiedSinceIso,
        lovableKey,
        driveKey,
      );
      for (const d of docs) {
        if (seenIds.has(d.id)) continue;
        seenIds.add(d.id);
        allDocs.push(d);
      }
    } catch (err) {
      console.warn(
        `Drive folder ${folderId} list error:`,
        (err as Error).message,
      );
    }
  }

  // Filter by transcript-like name and sort by modifiedTime desc
  const candidates = allDocs
    .filter((d) => TRANSCRIPT_NAME_REGEX.test(d.name))
    .sort((a, b) =>
      (b.modifiedTime || "").localeCompare(a.modifiedTime || ""),
    )
    .slice(0, maxTranscripts);

  const transcripts: DriveTranscript[] = [];
  for (const doc of candidates) {
    try {
      const text = await exportDriveDocAsText(doc.id, lovableKey, driveKey);
      if (text.trim().length > 50) {
        transcripts.push({ title: doc.name, text });
      }
    } catch (err) {
      console.warn(
        `Drive export ${doc.id} error:`,
        (err as Error).message,
      );
    }
  }

  return transcripts;
}

// =================== GMAIL ===================

interface GmailLight {
  subject: string;
  from: string;
  snippet: string;
  date?: string;
}

async function fetchGmailMessages(
  contactEmails: string[],
  projectName: string,
  clientName: string | null,
  lookbackDays: number,
  lovableKey: string,
  gmailKey: string,
  maxMessages = 25,
): Promise<GmailLight[]> {
  // Build query
  const parts: string[] = [];
  if (contactEmails.length > 0) {
    const fromTo = contactEmails
      .map((e) => `(from:${e} OR to:${e})`)
      .join(" OR ");
    parts.push(`(${fromTo})`);
  }
  const subjectClauses: string[] = [];
  if (projectName) subjectClauses.push(`subject:"${projectName}"`);
  if (clientName) subjectClauses.push(`subject:"${clientName}"`);
  if (subjectClauses.length > 0) parts.push(`(${subjectClauses.join(" OR ")})`);

  if (parts.length === 0) return [];

  const q = `(${parts.join(" OR ")}) newer_than:${lookbackDays}d -in:spam -in:trash`;

  const listParams = new URLSearchParams({
    q,
    maxResults: String(Math.min(maxMessages, 50)),
  });

  const listRes = await fetch(
    `${GMAIL_GATEWAY_URL}/users/me/messages?${listParams.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": gmailKey,
      },
    },
  );

  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`Gmail list error [${listRes.status}]: ${text.slice(0, 200)}`);
  }

  const listData = await listRes.json();
  const ids: string[] = (listData.messages || [])
    .map((m: any) => m.id)
    .slice(0, maxMessages);

  const results: GmailLight[] = [];
  for (const id of ids) {
    try {
      const params = new URLSearchParams({
        format: "metadata",
        metadataHeaders: "Subject",
      });
      // Two requests: one for headers (metadata), then we already have snippet from same call
      const detailRes = await fetch(
        `${GMAIL_GATEWAY_URL}/users/me/messages/${id}?${params.toString()}&metadataHeaders=From&metadataHeaders=Date`,
        {
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "X-Connection-Api-Key": gmailKey,
          },
        },
      );
      if (!detailRes.ok) continue;
      const detail = await detailRes.json();
      const headers: Array<{ name: string; value: string }> =
        detail?.payload?.headers || [];
      const subject =
        headers.find((h) => h.name.toLowerCase() === "subject")?.value || "";
      const from =
        headers.find((h) => h.name.toLowerCase() === "from")?.value || "";
      const date =
        headers.find((h) => h.name.toLowerCase() === "date")?.value || "";
      const snippet = (detail?.snippet || "").slice(0, 250);
      if (snippet.trim().length > 0) {
        results.push({ subject, from, snippet, date });
      }
    } catch (err) {
      console.warn(`Gmail detail ${id} error:`, (err as Error).message);
    }
  }

  return results;
}

// =================== AI ===================

interface AiSources {
  slack: string[];
  drive: DriveTranscript[];
  gmail: GmailLight[];
}

async function generateDraft(
  sources: AiSources,
  lovableKey: string,
  options: { fallbackEmpty?: boolean; lookbackDays?: number } = {},
): Promise<string> {
  const { fallbackEmpty = false, lookbackDays = 7 } = options;

  let userPrompt: string;

  if (fallbackEmpty) {
    userPrompt =
      `Negli ultimi ${lookbackDays} giorni non sono stati trovati segnali significativi né su Slack, né nelle trascrizioni Meet su Drive, né nelle email pertinenti.\n\n` +
      `Scrivi un progress update onesto di 2-3 frasi che segnali esplicitamente la mancanza di aggiornamenti recenti su queste fonti e suggerisca al PM di integrare manualmente le informazioni mancanti. Tono professionale, italiano, niente emoji.`;
  } else {
    const sections: string[] = [];

    if (sources.drive.length > 0) {
      const meetText = sources.drive
        .map(
          (d, i) =>
            `[Riunione ${i + 1}] ${d.title}\n${d.text.slice(0, 6000)}`,
        )
        .join("\n\n");
      sections.push(`### Trascrizioni riunioni Google Meet (priorità alta)\n${meetText}`);
    }

    if (sources.gmail.length > 0) {
      const emailText = sources.gmail
        .slice(0, 25)
        .map(
          (e, i) =>
            `${i + 1}. [${e.date || ""}] Oggetto: ${e.subject}\n   ${e.snippet}`,
        )
        .join("\n");
      sections.push(`### Email recenti\n${emailText}`);
    }

    if (sources.slack.length > 0) {
      const slackText = sources.slack
        .slice(0, 30)
        .map((t, i) => `${i + 1}. ${t.slice(0, 500)}`)
        .join("\n");
      sections.push(`### Messaggi Slack del canale di progetto\n${slackText}`);
    }

    userPrompt =
      `Ecco le informazioni raccolte sul progetto negli ultimi ${lookbackDays} giorni dalle fonti collegate. Scrivi un progress update di 3-5 frasi che sintetizzi cosa è stato fatto, le decisioni emerse e cosa è in corso.\n\n---\n${sections.join(
        "\n\n",
      )}\n---`;
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
    if (res.status === 429) throw new Error("AI rate limit");
    if (res.status === 402) throw new Error("AI credits exhausted");
    throw new Error(`AI gateway error ${res.status}: ${errText}`);
  }

  const json = await res.json();
  const content = json?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty AI response");
  return content;
}

// =================== HANDLER ===================

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const cronSecret = Deno.env.get("CRON_SECRET");
    const isCron = !!cronSecret && authHeader === `Bearer ${cronSecret}`;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!isCron) {
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
    const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
    const GOOGLE_MAIL_API_KEY = Deno.env.get("GOOGLE_MAIL_API_KEY");

    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY mancante." }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        },
      );
    }

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
    const lookbackDays = Math.min(
      Math.max(body.lookbackDays ?? (isManual ? 14 : 7), 1),
      30,
    );
    const minSignals = Math.max(body.minMessages ?? (isManual ? 1 : 3), 0);
    const minWords = isManual ? 3 : 5;

    const now = new Date();
    const weekStart = getMondayOfWeek(now);
    const weekStartStr = toDateOnly(weekStart);
    const oldestTs = Math.floor(
      (now.getTime() - lookbackDays * 24 * 60 * 60 * 1000) / 1000,
    );
    const modifiedSinceIso = new Date(
      now.getTime() - lookbackDays * 24 * 60 * 60 * 1000,
    ).toISOString();

    // Fetch eligible projects with client info (drive folders)
    let projectsQuery = supabaseAdmin
      .from("projects")
      .select(
        "id, name, slack_channel_id, slack_channel_name, project_leader_id, status, project_status, drive_folder_id, client_id, clients(id, name, drive_folder_id)",
      )
      .eq("status", "approvato");
    if (targetProjectId) {
      projectsQuery = projectsQuery.eq("id", targetProjectId);
    }
    const { data: projects, error: projErr } = await projectsQuery;
    if (projErr) throw projErr;

    // Eligibility: must have at least one source available
    const eligibleProjects = (projects || []).filter((p: any) => {
      if (p.project_status === "completato") return false;
      const hasSlack = !!p.slack_channel_id && !!SLACK_API_KEY;
      const hasDrive =
        !!GOOGLE_DRIVE_API_KEY &&
        (!!p.drive_folder_id || !!p.clients?.drive_folder_id);
      const hasGmail = !!GOOGLE_MAIL_API_KEY && !!p.client_id;
      return hasSlack || hasDrive || hasGmail;
    });

    if (targetProjectId && eligibleProjects.length === 0) {
      return new Response(
        JSON.stringify({
          error:
            "Progetto non eleggibile: deve essere approvato e avere almeno una fonte collegata (Slack, Drive del progetto/cliente o Gmail).",
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

    for (const project of eligibleProjects as any[]) {
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

        const { data: existingDraft } = await supabaseAdmin
          .from("project_update_drafts")
          .select("id")
          .eq("project_id", project.id)
          .eq("week_start", weekStartStr)
          .eq("status", "pending")
          .limit(1)
          .maybeSingle();
        if (existingDraft) {
          if (!force && !isCron) {
            stats.skipped_existing_draft += 1;
            continue;
          }
          await supabaseAdmin
            .from("project_update_drafts")
            .delete()
            .eq("id", existingDraft.id);
        }

        // Fetch contact emails for Gmail filter
        let contactEmails: string[] = [];
        if (GOOGLE_MAIL_API_KEY && project.client_id) {
          const { data: contacts } = await supabaseAdmin
            .from("client_contacts")
            .select("email")
            .eq("client_id", project.client_id)
            .not("email", "is", null);
          contactEmails = (contacts || [])
            .map((c: any) => (c.email || "").trim())
            .filter((e: string) => e.length > 0 && e.includes("@"))
            .slice(0, 15);
        }

        // Fetch all sources in parallel — never let one failure abort the others
        const driveFolderIds = [
          project.drive_folder_id,
          project.clients?.drive_folder_id,
        ].filter(Boolean) as string[];

        const [slackResult, driveResult, gmailResult] = await Promise.allSettled([
          project.slack_channel_id && SLACK_API_KEY
            ? fetchSlackMessages(
                project.slack_channel_id,
                oldestTs,
                LOVABLE_API_KEY,
                SLACK_API_KEY,
              )
            : Promise.resolve([] as SlackMessage[]),
          driveFolderIds.length > 0 && GOOGLE_DRIVE_API_KEY
            ? fetchDriveTranscripts(
                driveFolderIds,
                modifiedSinceIso,
                LOVABLE_API_KEY,
                GOOGLE_DRIVE_API_KEY,
              )
            : Promise.resolve([] as DriveTranscript[]),
          GOOGLE_MAIL_API_KEY &&
          (contactEmails.length > 0 || project.name || project.clients?.name)
            ? fetchGmailMessages(
                contactEmails,
                project.name,
                project.clients?.name || null,
                lookbackDays,
                LOVABLE_API_KEY,
                GOOGLE_MAIL_API_KEY,
              )
            : Promise.resolve([] as GmailLight[]),
        ]);

        const rawSlack =
          slackResult.status === "fulfilled" ? slackResult.value : [];
        const driveTranscripts =
          driveResult.status === "fulfilled" ? driveResult.value : [];
        const gmailMessages =
          gmailResult.status === "fulfilled" ? gmailResult.value : [];

        if (slackResult.status === "rejected") {
          console.warn(
            `Slack fetch failed for ${project.id}:`,
            (slackResult.reason as Error)?.message,
          );
        }
        if (driveResult.status === "rejected") {
          console.warn(
            `Drive fetch failed for ${project.id}:`,
            (driveResult.reason as Error)?.message,
          );
        }
        if (gmailResult.status === "rejected") {
          console.warn(
            `Gmail fetch failed for ${project.id}:`,
            (gmailResult.reason as Error)?.message,
          );
        }

        const relevantSlack = filterRelevantSlack(rawSlack, minWords);
        const totalSignals =
          relevantSlack.length + driveTranscripts.length + gmailMessages.length;

        const useFallback = totalSignals < minSignals;
        if (useFallback && !(isManual && force)) {
          stats.skipped_no_messages += 1;
          continue;
        }

        const sourcesUsed: string[] = [];
        if (relevantSlack.length > 0) sourcesUsed.push("slack");
        if (driveTranscripts.length > 0) sourcesUsed.push("drive_meet");
        if (gmailMessages.length > 0) sourcesUsed.push("gmail");

        const draftContent = await generateDraft(
          {
            slack: relevantSlack,
            drive: driveTranscripts,
            gmail: gmailMessages,
          },
          LOVABLE_API_KEY,
          { fallbackEmpty: useFallback, lookbackDays },
        );

        const { data: insertedDraft, error: insErr } = await supabaseAdmin
          .from("project_update_drafts")
          .insert({
            project_id: project.id,
            draft_content: draftContent,
            generated_from: "multi_source_ai",
            slack_messages_count: relevantSlack.length,
            drive_docs_count: driveTranscripts.length,
            gmail_messages_count: gmailMessages.length,
            sources_used: sourcesUsed,
            week_start: weekStartStr,
            status: "pending",
          })
          .select("id")
          .single();
        if (insErr) throw insErr;

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

    console.log(
      "generate-progress-drafts (multi-source) stats:",
      JSON.stringify(stats),
    );

    return new Response(JSON.stringify({ success: true, stats }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err: any) {
    console.error("generate-progress-drafts fatal:", err);
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
