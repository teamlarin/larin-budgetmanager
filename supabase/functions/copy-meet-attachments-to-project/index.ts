import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
  // Search for existing "Meeting" folder under parent
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(jwt);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { tracking_id } = await req.json();
    if (!tracking_id) {
      return new Response(JSON.stringify({ error: "tracking_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Load tracking + budget item + project
    const { data: tracking, error: trackErr } = await supabase
      .from("activity_time_tracking")
      .select("id, user_id, google_event_id, scheduled_date, budget_item_id, budget_items:budget_item_id (project_id, projects:project_id (id, name, drive_folder_id))")
      .eq("id", tracking_id)
      .maybeSingle();

    if (trackErr || !tracking) {
      return new Response(JSON.stringify({ error: "Tracking not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!tracking.google_event_id) {
      return new Response(JSON.stringify({ skipped: "no_google_event" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const project = (tracking as any).budget_items?.projects;
    if (!project?.drive_folder_id) {
      console.log(`No drive folder for project of tracking ${tracking_id}`);
      return new Response(JSON.stringify({ skipped: "no_project_drive_folder" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get user google tokens
    const { data: tokenData } = await supabase
      .from("user_google_tokens")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!tokenData) {
      return new Response(JSON.stringify({ skipped: "no_google_tokens" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let accessToken = tokenData.access_token;
    if (new Date(tokenData.token_expiry) < new Date()) {
      const refreshed = await refreshAccessToken(tokenData.refresh_token);
      if (!refreshed) {
        return new Response(JSON.stringify({ skipped: "token_refresh_failed" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      accessToken = refreshed.access_token;
      await supabase.from("user_google_tokens").update({
        access_token: accessToken,
        token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("user_id", user.id);
    }

    // Try to fetch the event from selected calendars (or primary)
    const calendarIds: string[] = (tokenData.selected_calendars && tokenData.selected_calendars.length > 0)
      ? tokenData.selected_calendars
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

    if (!event) {
      return new Response(JSON.stringify({ skipped: "event_not_found" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Only proceed if user is organizer
    if (!event.organizer?.self) {
      return new Response(JSON.stringify({ skipped: "not_organizer" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const attachments: any[] = Array.isArray(event.attachments) ? event.attachments : [];
    // Only Google Doc transcripts
    const transcripts = attachments.filter(
      (a) => a.fileId && a.mimeType === "application/vnd.google-apps.document"
    );

    if (transcripts.length === 0) {
      return new Response(JSON.stringify({ copied: 0, skipped: "no_transcripts" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Date prefix from event start
    const startStr: string = event.start?.dateTime || event.start?.date || tracking.scheduled_date;
    const datePrefix = (startStr || "").substring(0, 10);
    const summary = (event.summary || "Meeting").replace(/[\\/:*?"<>|]/g, "-").trim();

    // Resolve "Meeting" subfolder
    const meetingFolderId = await findOrCreateMeetingFolder(accessToken, project.drive_folder_id);
    if (!meetingFolderId) {
      return new Response(JSON.stringify({ error: "Cannot resolve Meeting subfolder" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let copied = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const att of transcripts) {
      // Idempotency check
      const { data: existing } = await supabase
        .from("meet_attachment_copies")
        .select("id")
        .eq("tracking_id", tracking.id)
        .eq("source_file_id", att.fileId)
        .maybeSingle();
      if (existing) { skipped++; continue; }

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

    return new Response(JSON.stringify({ copied, skipped, errors, project: project.name }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("copy-meet-attachments error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
