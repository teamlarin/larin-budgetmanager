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

// Concurrency & size tuning (tweak here, no logic changes needed elsewhere)
const PROJECT_CONCURRENCY = 8;          // progetti elaborati in parallelo
const DRIVE_EXPORT_CONCURRENCY = 5;     // export doc paralleli
const GMAIL_DETAIL_CONCURRENCY = 10;    // dettagli messaggi Gmail in parallelo
const FETCH_TIMEOUT_MS = 15_000;        // timeout per ogni fetch esterna
const MAX_TRANSCRIPTS = 3;              // ridotto da 5
const TRANSCRIPT_MAX_CHARS = 3000;      // ridotto da 6000/8000
const MAX_GMAIL_MESSAGES = 15;          // ridotto da 25
const MAX_SLACK_FOR_PROMPT = 20;        // ridotto da 30
const SLACK_MAX_PAGES = 3;              // ridotto da 5

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

// =================== UTILITIES ===================

/** Run async fn over items with bounded concurrency. Preserves input order. */
async function pMapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.min(limit, items.length || 1))
    .fill(0)
    .map(async () => {
      while (true) {
        const i = cursor++;
        if (i >= items.length) return;
        results[i] = await fn(items[i], i);
      }
    });
  await Promise.all(workers);
  return results;
}

/** fetch with hard timeout via AbortController */
async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
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

  do {
    const params = new URLSearchParams({
      channel: channelId,
      limit: "200",
      oldest: String(oldestTs),
    });
    if (cursor) params.set("cursor", cursor);

    const res = await fetchWithTimeout(
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
  } while (cursor && pages < SLACK_MAX_PAGES);

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

  const res = await fetchWithTimeout(
    `${DRIVE_GATEWAY_URL}/files?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": driveKey,
      },
    },
  );

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

  // Recurse into subfolders IN PARALLEL (was sequential — main Drive bottleneck)
  if (subfolders.length > 0) {
    const childResults = await Promise.allSettled(
      subfolders.map((sub) =>
        listDriveDocsInFolder(
          sub.id,
          modifiedSinceIso,
          lovableKey,
          driveKey,
          depth + 1,
          maxDepth,
        ),
      ),
    );
    for (let i = 0; i < childResults.length; i++) {
      const r = childResults[i];
      if (r.status === "fulfilled") {
        docs.push(...r.value);
      } else {
        console.warn(
          `Drive subfolder ${subfolders[i].id} error:`,
          (r.reason as Error)?.message,
        );
      }
    }
  }

  return docs;
}

async function exportDriveDocAsText(
  fileId: string,
  lovableKey: string,
  driveKey: string,
  maxChars = TRANSCRIPT_MAX_CHARS,
): Promise<string> {
  const res = await fetchWithTimeout(
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
  maxTranscripts = MAX_TRANSCRIPTS,
): Promise<DriveTranscript[]> {
  // List all root folders in parallel
  const listResults = await Promise.allSettled(
    folderIds
      .filter(Boolean)
      .map((folderId) =>
        listDriveDocsInFolder(folderId, modifiedSinceIso, lovableKey, driveKey),
      ),
  );

  const seenIds = new Set<string>();
  const allDocs: DriveFile[] = [];
  for (let i = 0; i < listResults.length; i++) {
    const r = listResults[i];
    if (r.status === "fulfilled") {
      for (const d of r.value) {
        if (seenIds.has(d.id)) continue;
        seenIds.add(d.id);
        allDocs.push(d);
      }
    } else {
      console.warn(
        `Drive folder ${folderIds[i]} list error:`,
        (r.reason as Error)?.message,
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

  // Export candidates in parallel (bounded)
  const exported = await pMapWithConcurrency(
    candidates,
    DRIVE_EXPORT_CONCURRENCY,
    async (doc) => {
      try {
        const text = await exportDriveDocAsText(doc.id, lovableKey, driveKey);
        if (text.trim().length > 50) {
          return { title: doc.name, text } as DriveTranscript;
        }
      } catch (err) {
        console.warn(
          `Drive export ${doc.id} error:`,
          (err as Error).message,
        );
      }
      return null;
    },
  );

  return exported.filter((t): t is DriveTranscript => t !== null);
}

// =================== GMAIL ===================

interface GmailLight {
  subject: string;
  from: string;
  snippet: string;
  date?: string;
}

// =================== SERVICE ACCOUNT (Domain-Wide Delegation) ===================

const GMAIL_DIRECT_API = "https://gmail.googleapis.com/gmail/v1";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const SA_TOKEN_TTL_MS = 50 * 60 * 1000; // 50min, Google issues 1h tokens

interface CachedToken {
  token: string;
  expiresAt: number;
}
const saTokenCache = new Map<string, CachedToken>();
let cachedPrivateKey: CryptoKey | null = null;

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeJson(obj: unknown): string {
  return base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const cleaned = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\\n/g, "\n")
    .replace(/\s+/g, "");
  const bin = atob(cleaned);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

async function getServiceAccountPrivateKey(): Promise<CryptoKey> {
  if (cachedPrivateKey) return cachedPrivateKey;
  const pem = Deno.env.get("GOOGLE_SA_PRIVATE_KEY");
  if (!pem) throw new Error("GOOGLE_SA_PRIVATE_KEY not configured");
  const keyBuf = pemToArrayBuffer(pem);
  cachedPrivateKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBuf,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return cachedPrivateKey;
}

/**
 * Get an OAuth access token impersonating `userEmail` via Domain-Wide Delegation.
 * Returns null (without throwing) if the SA is not configured or the email
 * is outside the allowed workspace domain — caller should fall back gracefully.
 */
async function getGmailAccessTokenForUser(
  userEmail: string,
): Promise<string | null> {
  const saEmail = Deno.env.get("GOOGLE_SA_CLIENT_EMAIL");
  const pem = Deno.env.get("GOOGLE_SA_PRIVATE_KEY");
  const domain = Deno.env.get("GOOGLE_WORKSPACE_DOMAIN");

  if (!saEmail || !pem || !domain) return null;

  const normalized = (userEmail || "").trim().toLowerCase();
  if (!normalized.endsWith(`@${domain.toLowerCase()}`)) {
    console.warn(
      `[gmail-impersonate] refused: ${normalized} is outside @${domain}`,
    );
    return null;
  }

  // Cache hit
  const cached = saTokenCache.get(normalized);
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.token;
  }

  try {
    const now = Math.floor(Date.now() / 1000);
    const header = { alg: "RS256", typ: "JWT" };
    const payload = {
      iss: saEmail,
      sub: normalized,
      scope: "https://www.googleapis.com/auth/gmail.readonly",
      aud: GOOGLE_TOKEN_URL,
      iat: now,
      exp: now + 3600,
    };

    const signingInput = `${base64UrlEncodeJson(header)}.${base64UrlEncodeJson(payload)}`;
    const key = await getServiceAccountPrivateKey();
    const sigBuf = await crypto.subtle.sign(
      "RSASSA-PKCS1-v1_5",
      key,
      new TextEncoder().encode(signingInput),
    );
    const jwt = `${signingInput}.${base64UrlEncode(new Uint8Array(sigBuf))}`;

    const res = await fetchWithTimeout(
      GOOGLE_TOKEN_URL,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion: jwt,
        }).toString(),
      },
      10_000,
    );

    if (!res.ok) {
      const txt = await res.text();
      console.warn(
        `[gmail-impersonate] token error for ${normalized} [${res.status}]: ${txt.slice(0, 200)}`,
      );
      return null;
    }
    const data = await res.json();
    const token = data?.access_token as string | undefined;
    if (!token) {
      console.warn(`[gmail-impersonate] empty token for ${normalized}`);
      return null;
    }
    saTokenCache.set(normalized, {
      token,
      expiresAt: Date.now() + SA_TOKEN_TTL_MS,
    });
    console.log(`[gmail-impersonate] ok user=${normalized}`);
    return token;
  } catch (err) {
    console.warn(
      `[gmail-impersonate] failed for ${normalized}:`,
      (err as Error).message,
    );
    return null;
  }
}

async function fetchGmailMessages(
  contactEmails: string[],
  projectName: string,
  clientName: string | null,
  lookbackDays: number,
  lovableKey: string,
  gmailKey: string,
  maxMessages = MAX_GMAIL_MESSAGES,
  impersonationToken: string | null = null,
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

  // If we have an impersonation token (Service Account + DWD), call Gmail
  // directly bypassing the Lovable connector gateway. Otherwise fall back to
  // the connector (= Alessandro's mailbox).
  const useImpersonation = !!impersonationToken;
  const baseUrl = useImpersonation ? GMAIL_DIRECT_API : GMAIL_GATEWAY_URL;
  const buildHeaders = (): HeadersInit =>
    useImpersonation
      ? { Authorization: `Bearer ${impersonationToken}` }
      : {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": gmailKey,
        };

  const listRes = await fetchWithTimeout(
    `${baseUrl}/users/me/messages?${listParams.toString()}`,
    { headers: buildHeaders() },
  );

  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`Gmail list error [${listRes.status}]: ${text.slice(0, 200)}`);
  }

  const listData = await listRes.json();
  const ids: string[] = (listData.messages || [])
    .map((m: any) => m.id)
    .slice(0, maxMessages);

  // Fetch details in PARALLEL (was N+1 sequential)
  const details = await pMapWithConcurrency(
    ids,
    GMAIL_DETAIL_CONCURRENCY,
    async (id) => {
      try {
        const params = new URLSearchParams({
          format: "metadata",
          metadataHeaders: "Subject",
        });
        const detailRes = await fetchWithTimeout(
          `${baseUrl}/users/me/messages/${id}?${params.toString()}&metadataHeaders=From&metadataHeaders=Date`,
          { headers: buildHeaders() },
        );
        if (!detailRes.ok) return null;
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
          return { subject, from, snippet, date } as GmailLight;
        }
      } catch (err) {
        console.warn(`Gmail detail ${id} error:`, (err as Error).message);
      }
      return null;
    },
  );

  return details.filter((d): d is GmailLight => d !== null);
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
            `[Riunione ${i + 1}] ${d.title}\n${d.text.slice(0, TRANSCRIPT_MAX_CHARS)}`,
        )
        .join("\n\n");
      sections.push(`### Trascrizioni riunioni Google Meet (priorità alta)\n${meetText}`);
    }

    if (sources.gmail.length > 0) {
      const emailText = sources.gmail
        .slice(0, MAX_GMAIL_MESSAGES)
        .map(
          (e, i) =>
            `${i + 1}. [${e.date || ""}] Oggetto: ${e.subject}\n   ${e.snippet}`,
        )
        .join("\n");
      sections.push(`### Email recenti\n${emailText}`);
    }

    if (sources.slack.length > 0) {
      const slackText = sources.slack
        .slice(0, MAX_SLACK_FOR_PROMPT)
        .map((t, i) => `${i + 1}. ${t.slice(0, 500)}`)
        .join("\n");
      sections.push(`### Messaggi Slack del canale di progetto\n${slackText}`);
    }

    userPrompt =
      `Ecco le informazioni raccolte sul progetto negli ultimi ${lookbackDays} giorni dalle fonti collegate. Scrivi un progress update di 3-5 frasi che sintetizzi cosa è stato fatto, le decisioni emerse e cosa è in corso.\n\n---\n${sections.join(
        "\n\n",
      )}\n---`;
  }

  const res = await fetchWithTimeout(
    AI_GATEWAY_URL,
    {
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
    },
    30_000, // AI può legittimamente impiegare di più
  );

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

  const t0 = Date.now();

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

    // Lookup leader emails in batch (FK points to auth.users so we cannot embed)
    const leaderIds = Array.from(
      new Set(
        (projects || [])
          .map((p: any) => p.project_leader_id)
          .filter(Boolean) as string[],
      ),
    );
    const leaderEmailMap = new Map<string, string>();
    if (leaderIds.length > 0) {
      const { data: leaderProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, email")
        .in("id", leaderIds);
      for (const lp of (leaderProfiles || []) as Array<{ id: string; email: string | null }>) {
        if (lp.email) leaderEmailMap.set(lp.id, lp.email);
      }
    }

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
      avg_project_ms: 0,
      max_project_ms: 0,
      total_duration_ms: 0,
    };

    // Per-project worker, executed with bounded concurrency
    const perProjectMs: number[] = [];

    await pMapWithConcurrency(
      eligibleProjects as any[],
      PROJECT_CONCURRENCY,
      async (project: any) => {
        const pStart = Date.now();
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
            return;
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
              return;
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

          // Resolve impersonation token for the Project Leader (if @larin.it
          // and SA configured). Falls back to Lovable connector (Alessandro)
          // when null.
          const leaderEmail = project.project_leader_id
            ? leaderEmailMap.get(project.project_leader_id) || null
            : null;
          let gmailInboxUsed: string = "none";
          let impersonationToken: string | null = null;
          if (GOOGLE_MAIL_API_KEY) {
            if (leaderEmail) {
              impersonationToken = await getGmailAccessTokenForUser(leaderEmail);
              if (impersonationToken) {
                gmailInboxUsed = `service_account:${leaderEmail}`;
              }
            }
            if (!impersonationToken) {
              gmailInboxUsed = "lovable_connector"; // Alessandro fallback
            }
          }

          const slackStart = Date.now();
          const driveStart = Date.now();
          const gmailStart = Date.now();
          let slackMs = 0;
          let driveMs = 0;
          let gmailMs = 0;

          const [slackResult, driveResult, gmailResult] =
            await Promise.allSettled([
              project.slack_channel_id && SLACK_API_KEY
                ? fetchSlackMessages(
                    project.slack_channel_id,
                    oldestTs,
                    LOVABLE_API_KEY,
                    SLACK_API_KEY,
                  ).finally(() => {
                    slackMs = Date.now() - slackStart;
                  })
                : Promise.resolve([] as SlackMessage[]),
              driveFolderIds.length > 0 && GOOGLE_DRIVE_API_KEY
                ? fetchDriveTranscripts(
                    driveFolderIds,
                    modifiedSinceIso,
                    LOVABLE_API_KEY,
                    GOOGLE_DRIVE_API_KEY,
                  ).finally(() => {
                    driveMs = Date.now() - driveStart;
                  })
                : Promise.resolve([] as DriveTranscript[]),
              GOOGLE_MAIL_API_KEY &&
              (contactEmails.length > 0 ||
                project.name ||
                project.clients?.name)
                ? fetchGmailMessages(
                    contactEmails,
                    project.name,
                    project.clients?.name || null,
                    lookbackDays,
                    LOVABLE_API_KEY,
                    GOOGLE_MAIL_API_KEY,
                    MAX_GMAIL_MESSAGES,
                    impersonationToken,
                  ).finally(() => {
                    gmailMs = Date.now() - gmailStart;
                  })
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
            relevantSlack.length +
            driveTranscripts.length +
            gmailMessages.length;

          const useFallback = totalSignals < minSignals;
          if (useFallback && !(isManual && force)) {
            stats.skipped_no_messages += 1;
            const elapsed = Date.now() - pStart;
            perProjectMs.push(elapsed);
            console.log(
              `[draft] ${project.id} skipped_no_signals total=${elapsed}ms slack=${slackMs}ms drive=${driveMs}ms gmail=${gmailMs}ms`,
            );
            return;
          }

          const sourcesUsed: string[] = [];
          if (relevantSlack.length > 0) sourcesUsed.push("slack");
          if (driveTranscripts.length > 0) sourcesUsed.push("drive_meet");
          if (gmailMessages.length > 0) sourcesUsed.push("gmail");

          const aiStart = Date.now();
          const draftContent = await generateDraft(
            {
              slack: relevantSlack,
              drive: driveTranscripts,
              gmail: gmailMessages,
            },
            LOVABLE_API_KEY,
            { fallbackEmpty: useFallback, lookbackDays },
          );
          const aiMs = Date.now() - aiStart;

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
              gmail_inbox_used: gmailInboxUsed,
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
          const elapsed = Date.now() - pStart;
          perProjectMs.push(elapsed);
          console.log(
            `[draft] ${project.id} ok inbox=${gmailInboxUsed} total=${elapsed}ms slack=${slackMs}ms drive=${driveMs}ms gmail=${gmailMs}ms ai=${aiMs}ms signals=${totalSignals}`,
          );
        } catch (err: any) {
          console.error(
            `Error processing project ${project.id}:`,
            err?.message || err,
          );
          stats.errors.push({
            project_id: project.id,
            error: err?.message || String(err),
          });
          perProjectMs.push(Date.now() - pStart);
        }
      },
    );

    if (perProjectMs.length > 0) {
      stats.avg_project_ms = Math.round(
        perProjectMs.reduce((a, b) => a + b, 0) / perProjectMs.length,
      );
      stats.max_project_ms = Math.max(...perProjectMs);
    }
    stats.total_duration_ms = Date.now() - t0;

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
