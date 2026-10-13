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
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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

async function getUserAccessToken(supabase: any, userId: string): Promise<{ token: string; calendars: string[] } | null> {
  const { data: t } = await supabase.from("user_google_tokens").select("*").eq("user_id", userId).maybeSingle();
  if (!t) return null;
  let token = t.access_token as string;
  if (!t.token_expiry || new Date(t.token_expiry) < new Date(Date.now() + 60_000)) {
    if (!t.refresh_token) return null;
    const r = await refreshAccessToken(t.refresh_token);
    if (!r) return null;
    token = r.access_token;
    await supabase.from("user_google_tokens").update({
      access_token: token,
      token_expiry: new Date(Date.now() + r.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
  }
  const calendars = (t.selected_calendars && t.selected_calendars.length > 0) ? [...t.selected_calendars, "primary"] : ["primary"];
  return { token, calendars };
}

async function getAdminIds(supabase: any): Promise<string[]> {
  const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
  const ids = (roles || []).map((r: any) => r.user_id);
  if (ids.length === 0) return [];
  const { data: toks } = await supabase.from("user_google_tokens").select("user_id").in("user_id", ids);
  return (toks || []).map((t: any) => t.user_id);
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

async function findFileInFolder(token: string, folderId: string, name: string): Promise<string | null> {
  const q = `name='${escapeDriveQuery(name)}' and '${folderId}' in parents and trashed=false`;
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id)&pageSize=1&supportsAllDrives=true&includeItemsFromAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) return null;
  const d = await res.json();
  return d.files?.[0]?.id ?? null;
}

async function dedupeExisting(supabase: any, writerTokens: string[]) {
  const { data: rows } = await supabase.from("meet_attachment_copies")
    .select("id, project_id, google_event_id, source_file_id, copied_file_id, copied_at")
    .not("copied_file_id", "is", null).order("copied_at", { ascending: true });
  const keep = new Map<string, string>();
  let trashed = 0, failed = 0;
  for (const r of rows || []) {
    const keys = [`${r.project_id}|e|${r.google_event_id}`, `${r.project_id}|s|${r.source_file_id}`];
    const kept = keys.map((k) => keep.get(k)).find(Boolean);
    if (!kept) { keys.forEach((k) => keep.set(k, r.copied_file_id)); continue; }
    keys.forEach((k) => { if (!keep.has(k)) keep.set(k, kept); });
    if (kept === r.copied_file_id) continue;
    let ok = false;
    for (const t of writerTokens) {
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(r.copied_file_id)}?supportsAllDrives=true`, {
        method: "PATCH", headers: { Authorization: `Bearer ${t}`, "Content-Type": "application/json" },
        body: JSON.stringify({ trashed: true }),
      });
      if (res.ok || res.status === 404) { ok = true; break; }
    }
    if (ok) {
      await supabase.from("meet_attachment_copies").update({ copied_file_id: kept }).eq("id", r.id);
      trashed++;
    } else failed++;
  }
  return { trashed, failed };
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
      `&fields=files(id,name,createdTime)&pageSize=50&orderBy=createdTime desc` +
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


type Result = { tracking_id: string; copied: number; already_copied: number; skipped?: string; message: string; errors: string[]; used_account?: string };

async function tryWithToken(supabase: any, tracking: any, project: any, tok: { token: string; calendars: string[] }, callerId: string, writerTokens: string[] = []) {
  const accessToken = tok.token;
  let event: any = null;
  for (const calId of tok.calendars) {
    const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(tracking.google_event_id)}?fields=id,summary,start,organizer,attachments`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.ok) { event = await res.json(); break; }
  }
  const startStr: string = event?.start?.dateTime || event?.start?.date || tracking.scheduled_date;
  const datePrefix = (startStr || "").substring(0, 10);
  const rawSummary = event?.summary || tracking.google_event_title || "Meeting";
  const summary = rawSummary.replace(/[\\/:*?"<>|]/g, "-").trim();

  const attachments: any[] = Array.isArray(event?.attachments) ? event.attachments : [];
  let sources: { fileId: string; name?: string }[] = attachments
    .filter((a) => a.fileId && a.mimeType === DOC_MIME)
    .map((a) => ({ fileId: a.fileId, name: a.title }));
  if (sources.length === 0) sources = await searchDriveTranscripts(accessToken, rawSummary, datePrefix || null);
  if (sources.length === 0) return { copied: 0, already: 0, errors: [] as string[], status: "no_transcripts" };

  // Writers: reader token first, then admin tokens (reader may only have drive.readonly)
  const writers: string[] = [accessToken];
  for (const w of writerTokens) if (!writers.includes(w)) writers.push(w);

  let writer: string | null = null;
  let meetingFolderId: string | null = null;
  for (const w of writers) {
    meetingFolderId = await findOrCreateMeetingFolder(w, project.drive_folder_id);
    if (meetingFolderId) { writer = w; break; }
  }
  if (!meetingFolderId || !writer) return { copied: 0, already: 0, errors: ["folder_access"], status: "folder_error" };

  let copied = 0, already = 0;
  const errors: string[] = [];
  const name = `${datePrefix} - ${summary} - Trascrizione`;

  // Project-level dedup: one transcript per meeting per project, whoever saved it.
  const { data: prior } = await supabase.from("meet_attachment_copies")
    .select("copied_file_id, source_file_id, google_event_id")
    .eq("project_id", project.id)
    .or(`google_event_id.eq.${tracking.google_event_id},source_file_id.in.(${sources.map((s) => s.fileId).join(",")})`)
    .not("copied_file_id", "is", null).limit(1);
  let reuseId: string | null = prior?.[0]?.copied_file_id ?? null;
  // Defensive check on Drive: same name already in the Meeting folder
  if (!reuseId) reuseId = await findFileInFolder(writer, meetingFolderId, name);
  if (reuseId) {
    const { data: mine } = await supabase.from("meet_attachment_copies").select("id").eq("tracking_id", tracking.id).limit(1);
    if (!mine?.length) {
      await supabase.from("meet_attachment_copies").insert({
        tracking_id: tracking.id, google_event_id: tracking.google_event_id,
        source_file_id: prior?.[0]?.source_file_id || sources[0].fileId,
        copied_file_id: reuseId, project_id: project.id, copied_by: callerId,
      });
    }
    return { copied: 0, already: 1, errors, status: "ok" };
  }

  for (const att of sources.slice(0, 1)) {
    let newId: string | null = null;

    // 1) Direct copy if the writer is the reader
    if (writer === accessToken) {
      const copyRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(att.fileId)}/copy?supportsAllDrives=true&fields=id`,
        { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({ name, parents: [meetingFolderId] }) },
      );
      if (copyRes.ok) newId = (await copyRes.json()).id;
      else console.error("Direct copy failed:", copyRes.status, await copyRes.text());
    }

    // 2) Read with reader (export), write with a writer token (upload converted to Google Doc)
    if (!newId) {
      const exp = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(att.fileId)}/export?mimeType=${encodeURIComponent(DOCX_MIME)}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!exp.ok) { console.error("Export failed:", exp.status, await exp.text()); errors.push(`export_${exp.status}`); continue; }
      const content = await exp.blob();
      for (const w of writers) {
        const folderForW = w === writer ? meetingFolderId : await findOrCreateMeetingFolder(w, project.drive_folder_id);
        if (!folderForW) continue;
        const boundary = `b${crypto.randomUUID()}`;
        const meta = JSON.stringify({ name, parents: [folderForW], mimeType: DOC_MIME });
        const body = new Blob([
          `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n`,
          `--${boundary}\r\nContent-Type: ${DOCX_MIME}\r\n\r\n`, content, `\r\n--${boundary}--`,
        ]);
        const up = await fetch(
          `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id`,
          { method: "POST", headers: { Authorization: `Bearer ${w}`, "Content-Type": `multipart/related; boundary=${boundary}` }, body },
        );
        if (up.ok) { newId = (await up.json()).id; break; }
        console.error("Upload failed:", up.status, await up.text());
      }
      if (!newId) { errors.push("upload_failed"); continue; }
    }

    await supabase.from("meet_attachment_copies").insert({
      tracking_id: tracking.id, google_event_id: tracking.google_event_id, source_file_id: att.fileId,
      copied_file_id: newId, project_id: project.id, copied_by: callerId,
    });
    copied++;
  }
  return { copied, already, errors, status: copied > 0 || already > 0 ? "ok" : "copy_error" };
}

async function processTracking(supabase: any, trackingId: string, callerId: string, adminIds: string[]): Promise<Result> {
  const { data: tracking } = await supabase.from("activity_time_tracking")
    .select("id, user_id, google_event_id, google_event_title, scheduled_date, budget_items:budget_item_id (project_id, projects:project_id (id, name, drive_folder_id))")
    .eq("id", trackingId).maybeSingle();
  const base = { tracking_id: trackingId, copied: 0, already_copied: 0, errors: [] as string[] };
  if (!tracking) return { ...base, skipped: "not_found", message: "Attività non trovata." };
  if (!tracking.google_event_id) return { ...base, skipped: "no_google_event", message: "Questa attività non è collegata a un evento Google." };
  const project = tracking.budget_items?.projects;
  if (!project?.drive_folder_id) return { ...base, skipped: "no_project_drive_folder", message: "Il progetto non ha una cartella Drive collegata." };

  const candidates = [tracking.user_id, ...adminIds.filter((id) => id !== tracking.user_id)];
  let last = "no_tokens";
  const allErrors: string[] = [];
  const writerTokens: string[] = [];
  for (const aid of adminIds) { const t = await getUserAccessToken(supabase, aid); if (t) writerTokens.push(t.token); }
  for (const uid of candidates) {
    const tok = await getUserAccessToken(supabase, uid);
    if (!tok) continue;
    const r = await tryWithToken(supabase, tracking, project, tok, callerId, writerTokens);
    allErrors.push(...r.errors);
    if (r.status === "ok") {
      return { ...base, copied: r.copied, already_copied: r.already, errors: [], used_account: uid === tracking.user_id ? "owner" : "admin",
        message: r.copied > 0 ? `Trascrizione copiata nella cartella Meeting di ${project.name}.` : "La trascrizione era già stata copiata nel progetto." };
    }
    if (last !== "copy_error" && last !== "folder_error") last = r.status;
    if (r.status !== "no_transcripts") last = r.status;
  }
  const messages: Record<string, string> = {
    no_tokens: "Nessun account Google collegato può accedere a questa riunione.",
    no_transcripts: "Nessuna trascrizione trovata su Drive per questa riunione (né per l'assegnatario né per gli admin).",
    folder_error: "Impossibile accedere alla cartella Drive del progetto con gli account disponibili.",
    copy_error: "Google ha rifiutato la copia della trascrizione (permessi sul file).",
  };
  return { ...base, errors: allErrors, skipped: last, message: messages[last] || "Nessuna trascrizione copiata." };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userError || !user) return json({ error: "Invalid token" }, 401);

    const body = await req.json().catch(() => ({}));
    const adminIds = await getAdminIds(supabase);

    if (body.dedupe) {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) return json({ error: "Solo gli admin possono rimuovere i doppioni." }, 403);
      const tokens: string[] = [];
      for (const aid of adminIds) { const t = await getUserAccessToken(supabase, aid); if (t) tokens.push(t.token); }
      return json(await dedupeExisting(supabase, tokens));
    }


    if (body.batch) {
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) return json({ error: "Solo gli admin possono avviare la sincronizzazione." }, 403);
      const days = Math.min(Math.max(Number(body.days) || 90, 1), 730);
      const offset = Math.max(Number(body.offset) || 0, 0);
      const limit = Math.min(Math.max(Number(body.limit) || 10, 1), 25);
      const since = new Date(Date.now() - days * 86400000).toISOString().substring(0, 10);

      let q = supabase.from("activity_time_tracking")
        .select("id, budget_items!inner(project_id, projects!inner(drive_folder_id))")
        .not("google_event_id", "is", null).not("actual_start_time", "is", null)
        .gte("scheduled_date", since).not("budget_items.projects.drive_folder_id", "is", null)
        .order("scheduled_date", { ascending: false }).order("id")
        .range(offset, offset + limit - 1);
      if (body.project_id) q = q.eq("budget_items.project_id", body.project_id);
      const { data: rows, error } = await q;
      if (error) return json({ error: error.message }, 500);
      const ids = (rows || []).map((r: any) => r.id);
      const { data: done } = ids.length
        ? await supabase.from("meet_attachment_copies").select("tracking_id").in("tracking_id", ids)
        : { data: [] };
      const doneSet = new Set((done || []).map((d: any) => d.tracking_id));
      const results: Result[] = [];
      let alreadyPresent = 0;
      for (const id of ids) {
        if (doneSet.has(id)) { alreadyPresent++; continue; }
        results.push(await processTracking(supabase, id, user.id, adminIds));
      }
      return json({
        processed: ids.length,
        copied: results.reduce((a, r) => a + r.copied, 0),
        already_present: alreadyPresent + results.filter((r) => r.already_copied > 0 && r.copied === 0).length,
        not_found: results.filter((r) => r.skipped === "no_transcripts").length,
        errors: results.filter((r) => r.skipped && r.skipped !== "no_transcripts").length,
        next_offset: ids.length === limit ? offset + limit : null,
      });
    }

    if (!body.tracking_id) return json({ error: "tracking_id required" }, 400);
    const r = await processTracking(supabase, body.tracking_id, user.id, adminIds);
    return json(r);
  } catch (e) {
    console.error("copy-meet-attachments error:", e);
    return json({ error: (e as Error).message, message: "Errore durante la copia della trascrizione." }, 500);
  }
});
