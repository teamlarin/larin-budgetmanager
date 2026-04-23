import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";

interface SlackChannel {
  id: string;
  name: string;
  is_private: boolean;
  is_archived: boolean;
}

interface ProjectRow {
  id: string;
  name: string;
  project_type: string | null;
  client_id: string | null;
  clients: { name: string } | null;
}

interface Candidate {
  channel_id: string;
  channel_name: string;
  is_private: boolean;
  score: number;
  confidence: "high" | "medium" | "low" | "none";
}

interface ProjectSuggestion {
  project_id: string;
  project_name: string;
  client_name: string | null;
  project_type: string | null;
  candidates: Candidate[];
  best_confidence: "high" | "medium" | "low" | "none";
}

// --- Normalization helpers -------------------------------------------------

const STOP_WORDS = new Set([
  "srl", "spa", "sas", "snc", "sa", "ag", "gmbh", "ltd", "llc", "inc", "co",
  "s", "p", "a", "r", "l", "di", "del", "dei", "della", "delle", "il", "la",
  "le", "lo", "gli", "i", "e", "ed", "o", "od", "u", "un", "una", "uno",
  "the", "of", "for", "and", "or", "to", "in", "on", "at", "by",
  "assistenza", "manutenzione", "lavorazioni", "supporto", "gestione",
  "sviluppo", "progetto", "consulenza", "analisi", "revisione", "creazione",
  "produzione", "annuale", "mensile", "trimestrale", "biennale", "triennale",
  "giornata", "giornate", "ore", "mese", "mesi", "anno", "anni",
  "campagna", "campagne", "pacchetto",
]);

// keywords that strongly hint at the project type / discipline
const TYPE_KEYWORDS = new Set([
  "sito", "web", "website", "site", "landing", "page", "pagina",
  "app", "mobile", "ios", "android",
  "social", "media", "ads", "adv", "advertising", "marketing", "automation",
  "video", "ai", "branding", "brand", "logo", "naming",
  "ecommerce", "shop", "store",
  "intranet", "extranet", "portal", "portale",
  "newsletter", "email", "mail",
  "seo", "sem", "google",
  "podcast", "evento", "event", "fiera", "stand",
  "formazione", "training", "workshop", "academy",
  "tiktok", "instagram", "facebook", "linkedin", "youtube",
  "figma", "design", "ux", "ui",
  "assemblea", "report", "presentazione",
]);

const NOISE_CHANNEL_TOKENS = new Set([
  "general", "random", "annunci", "annunci-generali",
  "team", "internal", "staff", "amministrazione", "hr",
  "tt", "lounge", "off-topic", "watercooler",
  "demo", "test", "playground", "sandbox",
]);

function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalize(s: string): string {
  return stripDiacritics(s.toLowerCase())
    .replace(/[._/\\-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length >= 2 && !/^\d+$/.test(t) && !STOP_WORDS.has(t));
}

function clientCoreTokens(clientName: string): string[] {
  const all = tokens(clientName);
  return all.filter((t) => t.length >= 3);
}

function projectKeywordTokens(projectName: string): string[] {
  return tokens(projectName).filter((t) => TYPE_KEYWORDS.has(t));
}

// --- Scoring ---------------------------------------------------------------

function scoreCandidate(
  channelName: string,
  clientTokens: string[],
  projectKeywords: string[],
  projectTypeTokens: string[],
): number {
  const chanNorm = normalize(channelName);
  const chanTokens = new Set(chanNorm.split(" ").filter(Boolean));

  let score = 0;

  if (clientTokens.length === 0) return -100;

  const clientPhrase = clientTokens.join(" ");
  if (clientPhrase.length >= 4 && chanNorm.includes(clientPhrase)) {
    score += 12;
  }

  let clientHits = 0;
  for (const t of clientTokens) {
    if (chanTokens.has(t) || chanNorm.includes(t)) {
      clientHits += 1;
      score += 5;
    }
  }
  if (clientHits === 0) score -= 15;

  for (const t of projectKeywords) {
    if (chanTokens.has(t) || chanNorm.includes(t)) score += 3;
  }

  for (const t of projectTypeTokens) {
    if (chanTokens.has(t) || chanNorm.includes(t)) score += 2;
  }

  for (const t of chanTokens) {
    if (NOISE_CHANNEL_TOKENS.has(t)) score -= 5;
  }

  if (chanTokens.size <= 4 && clientHits > 0) score += 1;

  return score;
}

function classifyConfidence(top: number, second: number): Candidate["confidence"] {
  if (top >= 14 && top - second >= 4) return "high";
  if (top >= 9) return "medium";
  if (top >= 5) return "low";
  return "none";
}

// --- Slack pagination ------------------------------------------------------

async function fetchAllChannels(
  lovableKey: string,
  slackKey: string,
): Promise<{ channels: SlackChannel[]; error?: { code: string; msg: string } }> {
  const all: SlackChannel[] = [];
  let cursor = "";
  let pages = 0;
  const MAX_PAGES = 30;

  do {
    const params = new URLSearchParams({
      limit: "999",
      exclude_archived: "true",
      types: "public_channel,private_channel",
    });
    if (cursor) params.set("cursor", cursor);

    const res = await fetch(
      `${GATEWAY_URL}/conversations.list?${params.toString()}`,
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
      const slackError = data?.error || `HTTP ${res.status}`;
      let code = "slack_api_error";
      if (slackError === "missing_scope" || slackError === "not_authed") {
        code = "missing_scope";
      } else if (
        slackError === "invalid_auth" ||
        slackError === "token_revoked"
      ) {
        code = "slack_not_connected";
      }
      return { channels: all, error: { code, msg: slackError } };
    }

    for (const c of data.channels || []) {
      all.push({
        id: c.id,
        name: c.name,
        is_private: !!c.is_private,
        is_archived: !!c.is_archived,
      });
    }
    cursor = data.response_metadata?.next_cursor || "";
    pages += 1;
  } while (cursor && pages < MAX_PAGES);

  return { channels: all };
}

// --- Handler ---------------------------------------------------------------

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
      token,
    );
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const userId = claims.claims.sub as string;

    const { data: rolesRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (rolesRows || []).map((r: any) => r.role);
    const allowed = roles.some((r: string) =>
      ["admin", "team_leader", "account", "coordinator"].includes(r)
    );
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: "slack_api_error",
          error: "LOVABLE_API_KEY non configurato",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    if (!SLACK_API_KEY) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: "slack_not_connected",
          error: "Slack non collegato. Apri Connettori → Slack.",
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    let body: { include_completed?: boolean; project_ids?: string[] } = {};
    try { body = (await req.json().catch(() => ({}))) || {}; } catch { body = {}; }

    let query = supabase
      .from("projects")
      .select("id, name, project_type, client_id, clients(name)")
      .is("slack_channel_id", null)
      .eq("status", "approvato");

    if (!body.include_completed) {
      query = query.or("project_status.is.null,project_status.neq.completato");
    }
    if (body.project_ids && body.project_ids.length > 0) {
      query = query.in("id", body.project_ids);
    }

    const { data: projectsRaw, error: projErr } = await query;
    if (projErr) {
      return new Response(
        JSON.stringify({ ok: false, code: "db_error", error: projErr.message }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }
    const projects = (projectsRaw || []) as unknown as ProjectRow[];

    const { channels, error: chanErr } = await fetchAllChannels(
      LOVABLE_API_KEY,
      SLACK_API_KEY,
    );
    if (chanErr) {
      return new Response(
        JSON.stringify({
          ok: false,
          code: chanErr.code,
          slack_error: chanErr.msg,
          error: `Errore Slack: ${chanErr.msg}`,
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
      );
    }

    const suggestions: ProjectSuggestion[] = projects.map((p) => {
      const clientName = p.clients?.name || "";
      const clientTokens = clientCoreTokens(clientName);
      const projectKeywords = projectKeywordTokens(p.name || "");
      const projectTypeTokens = p.project_type
        ? tokens(p.project_type).filter((t) => t.length >= 3)
        : [];

      const scored: Candidate[] = channels.map((ch) => {
        const score = scoreCandidate(
          ch.name,
          clientTokens,
          projectKeywords,
          projectTypeTokens,
        );
        return {
          channel_id: ch.id,
          channel_name: ch.name,
          is_private: ch.is_private,
          score,
          confidence: "none" as const,
        };
      });

      scored.sort((a, b) => b.score - a.score);
      const top3 = scored.slice(0, 3).filter((c) => c.score > 0);
      const topScore = top3[0]?.score ?? 0;
      const secondScore = top3[1]?.score ?? 0;
      const bestConf = classifyConfidence(topScore, secondScore);

      for (const c of top3) {
        if (c.score >= 14) c.confidence = "high";
        else if (c.score >= 9) c.confidence = "medium";
        else if (c.score >= 5) c.confidence = "low";
        else c.confidence = "none";
      }

      return {
        project_id: p.id,
        project_name: p.name,
        client_name: clientName || null,
        project_type: p.project_type,
        candidates: top3,
        best_confidence: bestConf,
      };
    });

    return new Response(
      JSON.stringify({
        ok: true,
        total_projects: projects.length,
        total_channels: channels.length,
        suggestions,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (err: any) {
    console.error("suggest-slack-channels-for-projects error:", err);
    return new Response(
      JSON.stringify({
        ok: false,
        code: "slack_api_error",
        error: err?.message || "Unknown error",
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
