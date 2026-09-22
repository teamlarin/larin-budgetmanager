import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DOC_MIME = "application/vnd.google-apps.document";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function refreshAccessToken(refreshToken: string) {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await r.json();
  if (data.error) return null;
  return { access_token: data.access_token as string, expires_in: data.expires_in as number };
}

async function findOrCreateMeetingFolder(accessToken: string, parentId: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='Meeting' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`
  );
  const searchRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (searchRes.ok) {
    const data = await searchRes.json();
    if (data.files && data.files.length > 0) return data.files[0].id;
  } else {
    console.error("Folder search failed:", await searchRes.text());
  }

  const createRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Meeting",
        mimeType: "application/vnd.google-apps.folder",
        parents: [parentId],
      }),
    }
  );
  if (!createRes.ok) {
    console.error("Folder creation failed:", await createRes.text());
    return null;
  }
  const created = await createRes.json();
  return created.id as string;
}

function escapeDriveQuery(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * Fallback: Meet transcripts are stored as Google Docs on Drive (usually in a
 * "Meet Recordings" folder) and are not always attached to the calendar event.
 * We look for documents whose name contains the event title.
 */
async function searchDriveTranscripts(
  accessToken: string,
  summary: string,
  eventDate: string | null
): Promise<{ fileId: string; name: string }[]> {
  const base = (summary || "").trim();
  if (base.length < 3) return [];

  const candidates = new Set<string>();
  candidates.add(base);
  // Meet often keeps only the first words of long titles
  const shortened = base.split(/\s+/).slice(0, 4).join(" ");
  if (shortened.length >= 3) candidates.add(shortened);

  const results = new Map<string, { fileId: string; name: string }>();

  for (const candidate of candidates) {
    const q = `mimeType='${DOC_MIME}' and trashed=false and name contains '${escapeDriveQuery(candidate)}'`;
    const url =
      `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}` +
      `&fields=files(id,name,createdTime)&pageSize=25&orderBy=createdTime desc` +
      `&supportsAllDrives=true&includeItemsFromAllDrives=true`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) {
      console.error("Drive transcript search failed:", await res.text());
      continue;
    }
    const data = await res.json();
    for (const f of data.files || []) {
      const name: string = f.name || "";
      // Keep only Meet transcript/notes documents
      const isTranscript = /trascrizione|transcript|appunti|notes|gemini/i.test(name);
      if (!isTranscript) continue;
      if (eventDate && f.createdTime) {
        // Transcript must be created around the meeting date (+/- 3 days)
        const created = new Date(f.createdTime).getTime();
        const target = new Date(`${eventDate}T00:00:00Z`).getTime();
        if (Math.abs(created - target) > 3 * 24 * 60 * 60 * 1000) continue;
      }
      results.set(f.id, { fileId: f.id, name });
    }
    if (results.size > 0) break;
  }

  return [...results.values()];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) return json({ error: "Invalid token" }, 401);

    const { tracking_id } = await req.json();
    if (!tracking_id) return json({ error: "tracking_id required" }, 400);

    const { data: tracking, error: trackErr } = await supabase
      .from("activity_time_tracking")
      .select("id, user_id, google_event_id, google_event_title, scheduled_date, budget_item_id, budget_items:budget_item_id (project_id, projects:project_id (id, name, drive_folder_id))")
      .eq("id", tracking_id)
      .maybeSingle();

    if (trackErr || !tracking) return json({ error: "Tracking not found" }, 404);
    if (!tracking.google_event_id) {
      return json({ copied: 0, skipped: "no_google_event", message: "Questa attività non è collegata a un evento Google." });
    }

    const project = (tracking as any).budget_items?.projects;
    if (!project?.drive_folder_id) {
      return json({ copied: 0, skipped: "no_project_drive_folder", message: "Il progetto non ha una cartella Drive collegata." });
    }

    const { data: tokenData } = await supabase
      .from("user_google_tokens")
      .select("*")
      .eq("user_id", tracking.user_id)
      .maybeSingle();

    if (!tokenData) {
      return json({ copied: 0, skipped: "no_google_tokens", message: "Google Calendar non è collegato per questa persona." });
    }

    let accessToken = tokenData.access_token;
    if (new Date(tokenData.token_expiry) < new Date()) {
      const refreshed = await refreshAccessToken(tokenData.refresh_token);
      if (!refreshed) {
        return json({ copied: 0, skipped: "token_refresh_failed", message: "Il collegamento a Google è scaduto: ricollega Google Calendar." });
      }
      accessToken = refreshed.access_token;
      await supabase.from("user_google_tokens").update({
        access_token: accessToken,
        token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("user_id", tracking.user_id);
    }

    const calendarIds: string[] = (tokenData.selected_calendars && tokenData.selected_calendars.length > 0)
      ? [...tokenData.selected_calendars, "primary"]
      : ["primary"];

    let event: any = null;
    for (const calId of calendarIds) {
      const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(tracking.google_event_id)}?fields=id,summary,start,organizer,attachments`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (res.ok) {
        event = await res.json();
        break;
      }
    }

    const startStr: string = event?.start?.dateTime || event?.start?.date || tracking.scheduled_date;
    const datePrefix = (startStr || "").substring(0, 10);
    const rawSummary = event?.summary || (tracking as any).google_event_title || "Meeting";
    const summary = rawSummary.replace(/[\\/:*?"<>|]/g, "-").trim();

    // 1) Attachments on the calendar event
    const attachments: any[] = Array.isArray(event?.attachments) ? event.attachments : [];
    let sources: { fileId: string; name?: string }[] = attachments
      .filter((a) => a.fileId && a.mimeType === DOC_MIME)
      .map((a) => ({ fileId: a.fileId, name: a.title }));
    let source = "event_attachment";

    // 2) Fallback: look for the transcript document directly on Drive
    if (sources.length === 0) {
      const found = await searchDriveTranscripts(accessToken, rawSummary, datePrefix || null);
      if (found.length > 0) {
        sources = found;
        source = "drive_search";
      }
    }

    if (sources.length === 0) {
      return json({
        copied: 0,
        skipped: "no_transcripts",
        source: event ? "event_found" : "event_not_found",
        message: event
          ? "Nessuna trascrizione trovata per questa riunione (né allegata all'evento né su Drive)."
          : "Evento Google non trovato e nessuna trascrizione individuata su Drive.",
      });
    }

    const meetingFolderId = await findOrCreateMeetingFolder(accessToken, project.drive_folder_id);
    if (!meetingFolderId) {
      return json({ copied: 0, error: "Cannot resolve Meeting subfolder", message: "Impossibile aprire o creare la sottocartella Meeting su Drive." }, 500);
    }

    let copied = 0;
    let alreadyCopied = 0;
    const errors: string[] = [];

    for (const att of sources) {
      const { data: existing } = await supabase
        .from("meet_attachment_copies")
        .select("id")
        .eq("tracking_id", tracking.id)
        .eq("source_file_id", att.fileId)
        .maybeSingle();
      if (existing) { alreadyCopied++; continue; }

      const newName = `${datePrefix} - ${summary} - Trascrizione`;
      const copyRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(att.fileId)}/copy?supportsAllDrives=true&fields=id`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName, parents: [meetingFolderId] }),
        }
      );

      if (!copyRes.ok) {
        const txt = await copyRes.text();
        console.error("Copy failed:", txt);
        errors.push(`${att.fileId}: ${copyRes.status}`);
        continue;
      }
      const copiedFile = await copyRes.json();

      await supabase.from("meet_attachment_copies").insert({
        tracking_id: tracking.id,
        google_event_id: tracking.google_event_id,
        source_file_id: att.fileId,
        copied_file_id: copiedFile.id,
        project_id: project.id,
        copied_by: user.id,
      });
      copied++;
    }

    const message = copied > 0
      ? `Trascrizione copiata nella cartella Meeting di ${project.name}.`
      : alreadyCopied > 0
        ? "La trascrizione era già stata copiata nel progetto."
        : errors.length > 0
          ? "Google ha rifiutato la copia della trascrizione (permessi sul file)."
          : "Nessuna trascrizione copiata.";

    return json({ copied, already_copied: alreadyCopied, errors, source, project: project.name, message });
  } catch (e) {
    console.error("copy-meet-attachments error:", e);
    return json({ error: (e as Error).message, message: "Errore durante la copia della trascrizione." }, 500);
  }
});
