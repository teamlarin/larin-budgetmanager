import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/slack/api";
const CHANNEL = "#larin-teamleader";

const AREAS: Array<{ key: string; label: string; emoji: string }> = [
  { key: "marketing", label: "MARKETING", emoji: "🎯" },
  { key: "branding", label: "BRANDING", emoji: "🎨" },
  { key: "tech", label: "TECH", emoji: "💻" },
];

const LEADERS = ["Alessandro Di Maio", "Marialivia Bassan"];

// ---------- helpers ----------

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function addDays(d: Date, days: number): Date {
  const n = new Date(d.getTime());
  n.setUTCDate(n.getUTCDate() + days);
  return n;
}

function romeHour(now: Date): number {
  const s = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Rome",
    hour: "2-digit",
    hour12: false,
  }).format(now);
  return parseInt(s, 10);
}

function romeParts(now: Date): { y: number; m: number; d: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    weekday: map[get("weekday")] ?? 1,
  };
}

/** Minutes between two HH:mm(:ss) strings, cross-midnight aware, capped at 16h. */
function minutesFromTimes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  let diff = eh * 60 + em - (sh * 60 + sm);
  if (diff < 0) diff += 24 * 60;
  return Math.min(diff, 16 * 60);
}

/** Minutes between two timestamps, cross-midnight aware, capped at 16h. */
function minutesFromTimestamps(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return 0;
  let diff = (e.getTime() - s.getTime()) / 60000;
  if (diff < 0) diff += 24 * 60;
  return Math.min(Math.max(diff, 0), 16 * 60);
}

function fmtHours(minutes: number): string {
  const total = Math.round(minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function weeklyContractHours(hours: number | null, period: string | null): number | null {
  if (hours == null) return null;
  switch (period) {
    case "daily":
      return hours * 5;
    case "monthly":
      return hours / 4.33;
    case "weekly":
    default:
      return hours;
  }
}

function fmtContract(weekly: number | null): string {
  if (weekly == null) return "📄 contratto n/d";
  const rounded = Math.round(weekly * 10) / 10;
  return `📄 ${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}h contratto`;
}

async function slackFetch(method: string, body: Record<string, unknown>) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY non configurato");
  if (!SLACK_API_KEY) throw new Error("SLACK_API_KEY non configurato");

  const res = await fetch(`${GATEWAY_URL}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SLACK_API_KEY,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    console.error(`Slack ${method} HTTP ${res.status}: ${text.slice(0, 500)}`);
    throw new Error(`Slack ${method} failed [${res.status}]: ${text.slice(0, 500)}`);
  }
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Slack ${method} non-JSON response: ${text.slice(0, 200)}`);
  }
  if (data.ok === false) {
    console.error(`Slack ${method} error: ${data.error}`);
    throw new Error(`Slack ${method} error: ${data.error}`);
  }
  return data;
}

/** Resolves leader display names into Slack mentions, falling back to plain text. */
async function resolveLeaderMentions(names: string[]): Promise<string[]> {
  try {
    const users: Array<{ id: string; names: string[] }> = [];
    let cursor = "";
    do {
      const page: any = await slackFetch("users.list", {
        limit: 200,
        ...(cursor ? { cursor } : {}),
      });
      for (const m of page.members ?? []) {
        users.push({
          id: m.id,
          names: [m.profile?.real_name, m.real_name, m.profile?.display_name, m.name]
            .filter(Boolean)
            .map((v: string) => v.toLowerCase()),
        });
      }
      cursor = page.response_metadata?.next_cursor ?? "";
    } while (cursor);

    return names.map((n) => {
      const hit = users.find((u) => u.names.includes(n.toLowerCase()));
      return hit ? `<@${hit.id}>` : n;
    });
  } catch (err) {
    console.warn("Impossibile risolvere le menzioni Slack:", err);
    return names;
  }
}

/** Paginated fetch of tracking rows in a date range. */
async function fetchTracking(supabase: any, from: string, to: string) {
  const rows: any[] = [];
  const pageSize = 1000;
  for (let page = 0; ; page++) {
    const { data, error } = await supabase
      .from("activity_time_tracking")
      .select("user_id, scheduled_date, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time")
      .gte("scheduled_date", from)
      .lte("scheduled_date", to)
      .range(page * pageSize, page * pageSize + pageSize - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("Authorization");
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let payload: any = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }
    const dryRun = payload?.dry_run === true;
    const force = payload?.force === true;

    const now = new Date();
    // Only send at 08:xx Rome time (two UTC cron slots cover DST)
    if (!force && !dryRun && romeHour(now) !== 8) {
      console.log(`Ora di Roma ${romeHour(now)} != 8, skip.`);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "not 8 AM Rome" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Determine the Monday of the current (Rome) week
    const rp = romeParts(now);
    const todayUtc = new Date(Date.UTC(rp.y, rp.m - 1, rp.d));
    const offsetToMonday = (rp.weekday + 6) % 7; // Mon=0
    const thisMonday = addDays(todayUtc, -offsetToMonday);
    const prevMonday = addDays(thisMonday, -7);
    const prevSunday = addDays(thisMonday, -1);
    const nextSunday = addDays(thisMonday, 6);

    const prevFrom = ymd(prevMonday);
    const prevTo = ymd(prevSunday);
    const nextFrom = ymd(thisMonday);
    const nextTo = ymd(nextSunday);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Team members in the three areas
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, full_name, area, contract_hours, contract_hours_period")
      .eq("approved", true)
      .is("deleted_at", null)
      .in("area", AREAS.map((a) => a.key));
    if (profilesError) throw profilesError;

    const members = profiles ?? [];
    const memberIds = new Set(members.map((p: any) => p.id));

    // Contract periods covering either week
    const { data: periods, error: periodsError } = await supabase
      .from("user_contract_periods")
      .select("user_id, start_date, end_date, contract_hours, contract_hours_period")
      .lte("start_date", nextTo);
    if (periodsError) throw periodsError;

    const [confirmedRows, plannedRows] = await Promise.all([
      fetchTracking(supabase, prevFrom, prevTo),
      fetchTracking(supabase, nextFrom, nextTo),
    ]);

    const confirmedMinutes = new Map<string, number>();
    for (const r of confirmedRows) {
      if (!memberIds.has(r.user_id)) continue;
      if (!r.actual_start_time || !r.actual_end_time) continue;
      const mins = minutesFromTimestamps(r.actual_start_time, r.actual_end_time);
      confirmedMinutes.set(r.user_id, (confirmedMinutes.get(r.user_id) ?? 0) + mins);
    }

    const plannedMinutes = new Map<string, number>();
    for (const r of plannedRows) {
      if (!memberIds.has(r.user_id)) continue;
      if (!r.scheduled_start_time || !r.scheduled_end_time) continue;
      const mins = minutesFromTimes(r.scheduled_start_time, r.scheduled_end_time);
      plannedMinutes.set(r.user_id, (plannedMinutes.get(r.user_id) ?? 0) + mins);
    }

    // Contract hours resolution (period active during next week, else profile default)
    const contractFor = (p: any): number | null => {
      const matches = (periods ?? [])
        .filter((cp: any) => cp.user_id === p.id)
        .filter((cp: any) => cp.start_date <= nextTo && (!cp.end_date || cp.end_date >= nextFrom))
        .sort((a: any, b: any) => (a.start_date < b.start_date ? 1 : -1));
      const match = matches[0];
      if (match && match.contract_hours != null) {
        return weeklyContractHours(
          Number(match.contract_hours),
          match.contract_hours_period ?? p.contract_hours_period ?? "weekly",
        );
      }
      return weeklyContractHours(
        p.contract_hours != null ? Number(p.contract_hours) : null,
        p.contract_hours_period ?? "weekly",
      );
    };

    const nameOf = (p: any) =>
      [p.first_name, p.last_name].filter(Boolean).join(" ") || p.full_name || "Utente";

    const mentions = dryRun ? LEADERS : await resolveLeaderMentions(LEADERS);
    const intro = `👋 Ciao leaders ${mentions[0]} e ${mentions[1]} ecco un report del vostro team:`;
    const period = `📊 Ore team — ✅ confermate ${fmtDate(prevFrom)}-${fmtDate(prevTo)} · 🗓️ pianificate ${fmtDate(nextFrom)}-${fmtDate(nextTo)}`;

    const sections: string[] = [];
    for (const area of AREAS) {
      const people = members
        .filter((p: any) => (p.area ?? "").toLowerCase() === area.key)
        .sort((a: any, b: any) => nameOf(a).localeCompare(nameOf(b)));
      if (people.length === 0) continue;

      let areaConfirmed = 0;
      let areaPlanned = 0;
      const lines = people.map((p: any) => {
        const c = confirmedMinutes.get(p.id) ?? 0;
        const pl = plannedMinutes.get(p.id) ?? 0;
        areaConfirmed += c;
        areaPlanned += pl;
        return ` • ${nameOf(p)} — ✅ ${fmtHours(c)} · 🗓️ ${fmtHours(pl)} · ${fmtContract(contractFor(p))}`;
      });

      sections.push(
        `${area.emoji} *${area.label}*\n${lines.join("\n")}\n ➤ Totale area: ✅ ${fmtHours(areaConfirmed)} · 🗓️ ${fmtHours(areaPlanned)}`,
      );
    }

    const messageText =
      sections.length > 0
        ? `${intro}\n\n${period}\n\n${sections.join("\n\n")}`
        : `${intro}\n\n${period}\n\n_Nessun membro del team trovato nelle aree Marketing, Branding, Tech._`;

    if (dryRun) {
      return new Response(JSON.stringify({ success: true, dry_run: true, message: messageText }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const blocks = [
      { type: "section", text: { type: "mrkdwn", text: `${intro}\n\n${period}` } },
      { type: "divider" },
      ...sections.map((s) => ({ type: "section", text: { type: "mrkdwn", text: s } })),
    ];

    await slackFetch("chat.postMessage", {
      channel: CHANNEL,
      text: messageText,
      blocks,
    });

    console.log(`Report ore team inviato su ${CHANNEL} (${sections.length} aree).`);

    return new Response(
      JSON.stringify({
        success: true,
        weeks: { confirmed: [prevFrom, prevTo], planned: [nextFrom, nextTo] },
        areas: sections.length,
        members: members.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Error in send-weekly-team-hours-report:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
