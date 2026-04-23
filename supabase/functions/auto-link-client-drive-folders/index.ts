import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID");
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const ROOT_DRIVE_NAME = "01 | CLIENTI - Server Larin Group";
const ROOT_FOLDER_NAME = "Clienti";

// ---------- helpers ----------

async function refreshAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID!,
      client_secret: GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!response.ok) return null;
  return await response.json();
}

function stripDiacritics(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const SUFFIXES = [
  "s.r.l.s.",
  "s.r.l.",
  "s.p.a.",
  "s.a.s.",
  "s.n.c.",
  "s.a.p.a.",
  "srls",
  "srl",
  "spa",
  "sas",
  "snc",
  "sapa",
  "sa",
  "sl",
  "ltd",
  "llc",
  "inc",
  "gmbh",
  "ag",
  "& c.",
  "& c",
  "e c.",
  "unipersonale",
  "società cooperativa",
  "soc. coop.",
  "soc coop",
  "coop",
];

function normalizeName(raw: string): string {
  if (!raw) return "";
  let s = stripDiacritics(raw).toLowerCase();
  // remove punctuation -> spaces
  s = s.replace(/[._,;:'"`’()\[\]{}\\\/]+/g, " ");
  s = s.replace(/&/g, " e ");
  s = s.replace(/-+/g, " ");
  // collapse whitespace
  s = s.replace(/\s+/g, " ").trim();

  // strip suffixes (repeatedly, in order longest-first)
  const sortedSuffixes = [...SUFFIXES].sort((a, b) => b.length - a.length);
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of sortedSuffixes) {
      const sufNorm = stripDiacritics(suf).toLowerCase().replace(/[.&]/g, " ").replace(/\s+/g, " ").trim();
      if (sufNorm && (s === sufNorm || s.endsWith(" " + sufNorm))) {
        s = s.slice(0, s.length - sufNorm.length).trim();
        changed = true;
        break;
      }
    }
  }
  return s.replace(/\s+/g, " ").trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

function similarity(a: string, b: string): number {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - dist / maxLen;
}

// ---------- Google Drive helpers ----------

async function gFetch(url: string, accessToken: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Drive API ${res.status}: ${txt}`);
  }
  return await res.json();
}

async function findSharedDrive(accessToken: string, name: string): Promise<string | null> {
  const data = await gFetch(
    `https://www.googleapis.com/drive/v3/drives?pageSize=100`,
    accessToken
  );
  const match = (data.drives || []).find(
    (d: any) => (d.name || "").trim().toLowerCase() === name.trim().toLowerCase()
  );
  return match?.id || null;
}

async function findFolderInDrive(
  accessToken: string,
  driveId: string,
  parentId: string,
  name: string
): Promise<string | null> {
  const q = encodeURIComponent(
    `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and name='${name.replace(/'/g, "\\'")}' and trashed=false`
  );
  const url =
    `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=10` +
    `&supportsAllDrives=true&includeItemsFromAllDrives=true&driveId=${driveId}&corpora=drive`;
  const data = await gFetch(url, accessToken);
  return data.files?.[0]?.id || null;
}

async function listAllChildFolders(
  accessToken: string,
  driveId: string,
  parentId: string
): Promise<{ id: string; name: string }[]> {
  const folders: { id: string; name: string }[] = [];
  let pageToken: string | undefined;
  do {
    const q = encodeURIComponent(
      `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
    );
    const params = new URLSearchParams({
      q: decodeURIComponent(q),
      fields: "files(id,name),nextPageToken",
      pageSize: "1000",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
      driveId,
      corpora: "drive",
      orderBy: "name",
    });
    if (pageToken) params.set("pageToken", pageToken);
    const url = `https://www.googleapis.com/drive/v3/files?${params.toString()}`;
    const data = await gFetch(url, accessToken);
    for (const f of data.files || []) folders.push({ id: f.id, name: f.name });
    pageToken = data.nextPageToken;
  } while (pageToken);
  return folders;
}

// ---------- main ----------

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userRes, error: userErr } = await supabase.auth.getUser(jwt);
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userRes.user;

    // Admin check
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Solo admin" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Google tokens
    const { data: tokenData, error: tokenErr } = await supabase
      .from("user_google_tokens")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (tokenErr || !tokenData) {
      return new Response(
        JSON.stringify({ error: "Google account non connesso", needsAuth: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    let accessToken = tokenData.access_token as string;
    if (new Date(tokenData.token_expiry) <= new Date()) {
      const refreshed = await refreshAccessToken(tokenData.refresh_token);
      if (!refreshed) {
        return new Response(
          JSON.stringify({ error: "Impossibile rinnovare il token Google", needsAuth: true }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      accessToken = refreshed.access_token;
      await supabase
        .from("user_google_tokens")
        .update({
          access_token: accessToken,
          token_expiry: new Date(Date.now() + refreshed.expires_in * 1000).toISOString(),
        })
        .eq("user_id", user.id);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "scan";

    // ---------- ACTION: scan ----------
    if (action === "scan") {
      // Find shared drive + Clienti folder
      const driveId = await findSharedDrive(accessToken, ROOT_DRIVE_NAME);
      if (!driveId) {
        return new Response(
          JSON.stringify({ error: `Drive condiviso "${ROOT_DRIVE_NAME}" non trovato` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const clientiFolderId = await findFolderInDrive(
        accessToken,
        driveId,
        driveId,
        ROOT_FOLDER_NAME
      );
      if (!clientiFolderId) {
        return new Response(
          JSON.stringify({ error: `Cartella "${ROOT_FOLDER_NAME}" non trovata nel drive condiviso` }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // List all client folders
      const folders = await listAllChildFolders(accessToken, driveId, clientiFolderId);
      console.log(`Found ${folders.length} folders under "${ROOT_FOLDER_NAME}"`);

      // Fetch unlinked clients
      const { data: clients, error: clientsErr } = await supabase
        .from("clients")
        .select("id, name, drive_folder_id")
        .is("drive_folder_id", null)
        .order("name");
      if (clientsErr) throw clientsErr;

      // Pre-normalize folder names
      const folderIndex = folders.map((f) => ({
        ...f,
        norm: normalizeName(f.name),
      }));

      const auto: any[] = [];
      const ambiguous: any[] = [];
      const none: any[] = [];

      for (const c of clients || []) {
        const cNorm = normalizeName(c.name);
        if (!cNorm) {
          none.push({ client_id: c.id, client_name: c.name, candidates: [] });
          continue;
        }

        const scored = folderIndex
          .map((f) => {
            let score = 0;
            if (f.norm === cNorm) score = 1;
            else if (f.norm && cNorm) {
              if (f.norm.includes(cNorm) || cNorm.includes(f.norm)) {
                const minLen = Math.min(f.norm.length, cNorm.length);
                const maxLen = Math.max(f.norm.length, cNorm.length);
                score = Math.max(0.85, minLen / maxLen);
              } else {
                score = similarity(f.norm, cNorm);
              }
            }
            return { folder_id: f.id, folder_name: f.name, score };
          })
          .filter((x) => x.score >= 0.78)
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        if (scored.length === 0) {
          none.push({ client_id: c.id, client_name: c.name, candidates: [] });
          continue;
        }

        const top = scored[0];
        const second = scored[1];
        const isAuto =
          top.score >= 0.95 ||
          (top.score >= 0.88 && (!second || top.score - second.score >= 0.08));

        const entry = {
          client_id: c.id,
          client_name: c.name,
          candidates: scored,
          best: top,
        };

        if (isAuto) auto.push(entry);
        else ambiguous.push(entry);
      }

      return new Response(
        JSON.stringify({
          drive_id: driveId,
          clienti_folder_id: clientiFolderId,
          total_folders: folders.length,
          total_unlinked_clients: clients?.length || 0,
          auto,
          ambiguous,
          none,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---------- ACTION: apply ----------
    if (action === "apply") {
      const links: { client_id: string; folder_id: string; folder_name: string }[] =
        body.links || [];
      if (!Array.isArray(links) || links.length === 0) {
        return new Response(JSON.stringify({ error: "Nessun collegamento fornito" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let updated = 0;
      const errors: any[] = [];
      for (const l of links) {
        if (!l.client_id || !l.folder_id) continue;
        const { error } = await supabase
          .from("clients")
          .update({
            drive_folder_id: l.folder_id,
            drive_folder_name: l.folder_name || null,
          })
          .eq("id", l.client_id);
        if (error) {
          errors.push({ client_id: l.client_id, error: error.message });
        } else {
          updated++;
        }
      }

      return new Response(JSON.stringify({ updated, errors }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Azione non valida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("auto-link-client-drive-folders error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
