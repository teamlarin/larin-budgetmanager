import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const DRIVE = "https://connector-gateway.lovable.dev/google_drive/drive/v3";
const AI_URL = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-6-astra";
const MAX_CHARS = 60_000;
const NAME_RE = /(transcript|trascriz|meet|recording|registrazione|riunione|appunti|notes|note)/i;

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("list"), projectId: z.string().uuid() }),
  z.object({
    action: z.literal("extract"),
    projectId: z.string().uuid(),
    fileId: z.string().min(5).max(200).optional(),
    text: z.string().max(MAX_CHARS * 2).optional(),
    team: z.array(z.object({ id: z.string().uuid(), name: z.string().max(200) })).max(100),
    activities: z.array(z.object({ id: z.string().uuid(), name: z.string().max(300) })).max(300),
  }),
]);

function driveHeaders() {
  return {
    Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
    "X-Connection-Api-Key": Deno.env.get("GOOGLE_DRIVE_API_KEY") ?? "",
  };
}

interface DFile { id: string; name: string; mimeType: string; modifiedTime?: string }

async function listDocs(folderId: string, depth = 0): Promise<DFile[]> {
  if (depth > 2) return [];
  const p = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: "files(id,name,mimeType,modifiedTime)",
    pageSize: "200",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  const r = await fetch(`${DRIVE}/files?${p}`, { headers: driveHeaders() });
  if (!r.ok) throw new Error(`Drive [${r.status}]`);
  const files: DFile[] = (await r.json()).files ?? [];
  const out: DFile[] = [];
  const subs: DFile[] = [];
  for (const f of files) {
    if (f.mimeType === "application/vnd.google-apps.folder") subs.push(f);
    else if (f.mimeType === "application/vnd.google-apps.document") out.push(f);
  }
  const nested = await Promise.allSettled(subs.map((s) => listDocs(s.id, depth + 1)));
  nested.forEach((n) => n.status === "fulfilled" && out.push(...n.value));
  return out;
}

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["tasks"],
  properties: {
    tasks: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "assignee_id", "due_date", "budget_item_id", "priority", "quote"],
        properties: {
          title: { type: "string" },
          description: { type: ["string", "null"] },
          assignee_id: { type: ["string", "null"] },
          due_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
          budget_item_id: { type: ["string", "null"] },
          priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
          quote: { type: ["string", "null"], description: "Frase della trascrizione da cui nasce la task" },
        },
      },
    },
  },
};

async function callAi(system: string, user: string): Promise<string> {
  const res = await fetch(AI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
      "Lovable-API-Key": Deno.env.get("LOVABLE_API_KEY") ?? "",
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: { format: { type: "json_schema", name: "meeting_tasks", strict: true, schema } },
    }),
  });
  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    const err = new Error(`AI [${res.status}] ${t.slice(0, 300)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      try {
        const ev = JSON.parse(data);
        if (ev.type === "response.output_text.delta") out += ev.delta ?? "";
        if (ev.type === "response.failed" || ev.type === "error") throw new Error(ev.error?.message || "AI error");
      } catch (e) {
        if (e instanceof SyntaxError) continue;
        throw e;
      }
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: u } = await userClient.auth.getUser();
    if (!u?.user) return json({ error: "Non autenticato" }, 401);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Richiesta non valida" }, 400);
    const body = parsed.data;

    const { data: allowed } = await userClient.rpc("can_access_project_tasks", { _project_id: body.projectId });
    if (!allowed) return json({ error: "Accesso al progetto negato" }, 403);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: project } = await admin
      .from("projects")
      .select("name, drive_folder_id, clients(name)")
      .eq("id", body.projectId)
      .maybeSingle();
    if (!project) return json({ error: "Progetto non trovato" }, 404);

    if (body.action === "list") {
      if (!project.drive_folder_id) return json({ files: [], reason: "no_folder" });
      if (!Deno.env.get("GOOGLE_DRIVE_API_KEY")) return json({ files: [], reason: "no_drive" });
      const docs = await listDocs(project.drive_folder_id);
      const files = docs
        .filter((d) => NAME_RE.test(d.name))
        .sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""))
        .slice(0, 20);
      return json({ files });
    }

    let transcript = (body.text ?? "").trim();
    if (body.fileId) {
      const r = await fetch(`${DRIVE}/files/${encodeURIComponent(body.fileId)}/export?mimeType=text/plain`, {
        headers: driveHeaders(),
      });
      if (!r.ok) return json({ error: "Impossibile leggere la trascrizione da Drive" }, 502);
      transcript = (await r.text()).trim();
    }
    if (transcript.length < 30) return json({ error: "Testo troppo breve da analizzare" }, 400);
    transcript = transcript.slice(0, MAX_CHARS);

    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome" }).format(new Date());
    const system =
      "Sei un project manager italiano. Dalla trascrizione di una riunione estrai SOLO impegni operativi concreti (action item) " +
      "che qualcuno del team deve svolgere. Regole: (1) non inventare nulla che non sia nella trascrizione; " +
      "(2) titolo breve con verbo all'infinito + oggetto (max 90 caratteri); (3) description: 1-2 frasi di contesto o null; " +
      "(4) assignee_id solo se la persona è chiaramente indicata e corrisponde a un membro del team fornito, altrimenti null; " +
      "(5) due_date in formato YYYY-MM-DD solo se la riunione cita una scadenza, calcolata rispetto alla data della riunione/oggi, altrimenti null; " +
      "(6) budget_item_id: l'attività a budget più coerente tra quelle fornite, null se nessuna è adatta; " +
      "(7) ignora impegni del cliente o di soggetti esterni al team; (8) massimo 15 task, niente duplicati; " +
      "(9) quote: breve frase originale da cui deriva la task.";
    const user =
      `Oggi: ${today}\nProgetto: ${project.name}${(project as any).clients?.name ? ` (cliente ${(project as any).clients.name})` : ""}\n\n` +
      `Team (id: nome):\n${body.team.map((t) => `${t.id}: ${t.name}`).join("\n") || "nessuno"}\n\n` +
      `Attività a budget (id: nome):\n${body.activities.map((a) => `${a.id}: ${a.name}`).join("\n") || "nessuna"}\n\n` +
      `TRASCRIZIONE:\n${transcript}`;

    let raw: string;
    try {
      raw = await callAi(system, user);
    } catch (e) {
      const status = (e as { status?: number }).status;
      console.error("AI error", e);
      if (status === 402) return json({ error: "Crediti AI esauriti" }, 402);
      if (status === 429) return json({ error: "Troppe richieste, riprova tra poco" }, 429);
      return json({ error: "Analisi AI non riuscita" }, status && status >= 400 ? status : 500);
    }

    let tasks: any[] = [];
    try {
      tasks = JSON.parse(raw).tasks ?? [];
    } catch {
      return json({ error: "Risposta AI non leggibile" }, 502);
    }
    const teamIds = new Set(body.team.map((t) => t.id));
    const actIds = new Set(body.activities.map((a) => a.id));
    const clean = tasks
      .filter((t) => typeof t.title === "string" && t.title.trim())
      .slice(0, 15)
      .map((t) => ({
        title: t.title.trim().slice(0, 200),
        description: t.description || null,
        assignee_id: teamIds.has(t.assignee_id) ? t.assignee_id : null,
        due_date: /^\d{4}-\d{2}-\d{2}$/.test(t.due_date ?? "") ? t.due_date : null,
        budget_item_id: actIds.has(t.budget_item_id) ? t.budget_item_id : null,
        priority: ["low", "medium", "high", "urgent"].includes(t.priority) ? t.priority : "medium",
        quote: t.quote || null,
      }));
    return json({ tasks: clean });
  } catch (e) {
    console.error("extract-tasks error", e);
    return json({ error: (e as Error).message || "Errore" }, 500);
  }
});
