import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");
const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

const SLACK_GATEWAY = "https://connector-gateway.lovable.dev/slack";

interface DetectionConfig {
  organizer_email_patterns: string[];
  keywords: string[];
}

interface DefaultTimes {
  start: string;
  end: string;
}

interface MappingRow {
  id: string;
  keyword: string;
  budget_item_id: string;
  priority: number;
  is_default: boolean;
}

async function refreshAccessToken(refreshToken: string): Promise<string | null> {
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
  const d = await r.json();
  if (!r.ok || !d.access_token) {
    console.error("refresh failed", d);
    return null;
  }
  return d.access_token;
}

function isJethrEvent(event: any, cfg: DetectionConfig): boolean {
  const orgEmail = (event.organizer?.email || event.creator?.email || "").toLowerCase();
  const summary = (event.summary || "").toLowerCase();
  const description = (event.description || "").toLowerCase();

  if (cfg.organizer_email_patterns?.some((p) => p && orgEmail.includes(p.toLowerCase()))) {
    return true;
  }
  const haystack = `${summary} ${description}`;
  if (cfg.keywords?.some((k) => k && haystack.includes(k.toLowerCase()))) {
    return true;
  }
  return false;
}

function resolveMapping(event: any, mappings: MappingRow[]): MappingRow | null {
  const title = (event.summary || "").toLowerCase();
  const sorted = [...mappings].sort((a, b) => a.priority - b.priority);
  for (const m of sorted) {
    if (m.is_default) continue;
    if (m.keyword && title.includes(m.keyword.toLowerCase())) return m;
  }
  return sorted.find((m) => m.is_default) || null;
}

function daysBetween(startISO: string, endISO: string, allDay: boolean): string[] {
  // Returns array of YYYY-MM-DD strings to plan
  const days: string[] = [];
  const start = new Date(startISO);
  // Google all-day events use end-exclusive date
  const endExclusive = new Date(endISO);
  if (!allDay) {
    days.push(start.toISOString().slice(0, 10));
    return days;
  }
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const end = new Date(Date.UTC(endExclusive.getUTCFullYear(), endExclusive.getUTCMonth(), endExclusive.getUTCDate()));
  while (cur < end) {
    days.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  if (days.length === 0) days.push(start.toISOString().slice(0, 10));
  return days;
}

function extractTimes(event: any, defaults: DefaultTimes): { start: string; end: string } {
  if (event.start?.dateTime && event.end?.dateTime) {
    const s = new Date(event.start.dateTime);
    const e = new Date(event.end.dateTime);
    return {
      start: `${String(s.getHours()).padStart(2, "0")}:${String(s.getMinutes()).padStart(2, "0")}`,
      end: `${String(e.getHours()).padStart(2, "0")}:${String(e.getMinutes()).padStart(2, "0")}`,
    };
  }
  return { start: defaults.start || "09:00", end: defaults.end || "18:00" };
}

async function sendSlackMessage(channel: string, text: string, blocks: any[]) {
  if (!SLACK_API_KEY || !LOVABLE_API_KEY || !channel) {
    console.warn("Slack not configured, skipping notification");
    return;
  }
  try {
    const r = await fetch(`${SLACK_GATEWAY}/chat.postMessage`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": SLACK_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ channel, text, blocks }),
    });
    const d = await r.json();
    if (!d.ok) console.error("Slack error", d);
  } catch (e) {
    console.error("Slack send failed", e);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth: accept either CRON_SECRET bearer or authenticated user
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let isAuthorized = false;
    if (CRON_SECRET && token === CRON_SECRET) {
      isAuthorized = true;
    } else if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        // Only admins can manually trigger
        const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
        isAuthorized = (roles || []).some((r: any) => r.role === "admin");
      }
    }
    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load settings
    const { data: settingsRows } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["jethr_enabled", "jethr_detection", "jethr_slack_channel", "jethr_default_times"]);

    const settings: Record<string, any> = {};
    (settingsRows || []).forEach((r: any) => { settings[r.setting_key] = r.setting_value; });

    if (settings.jethr_enabled !== true) {
      return new Response(JSON.stringify({ ok: true, skipped: "disabled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const detection: DetectionConfig = settings.jethr_detection || { organizer_email_patterns: [], keywords: [] };
    const defaultTimes: DefaultTimes = settings.jethr_default_times || { start: "09:00", end: "18:00" };
    const slackChannel: string = settings.jethr_slack_channel || "";

    // Load mappings
    const { data: mappings } = await supabase
      .from("jethr_absence_mappings")
      .select("id, keyword, budget_item_id, priority, is_default");
    const mappingList: MappingRow[] = mappings || [];

    if (mappingList.length === 0) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_mappings" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Time window: last 7 days .. next 90 days
    const now = new Date();
    const timeMin = new Date(now.getTime() - 7 * 24 * 3600 * 1000).toISOString();
    const timeMax = new Date(now.getTime() + 90 * 24 * 3600 * 1000).toISOString();

    // Load all users with google tokens
    const { data: tokens } = await supabase
      .from("user_google_tokens")
      .select("user_id, access_token, refresh_token, token_expiry, selected_calendars");

    const results: any[] = [];

    for (const tk of tokens || []) {
      try {
        let accessToken = tk.access_token;
        if (new Date(tk.token_expiry) < new Date()) {
          const refreshed = await refreshAccessToken(tk.refresh_token);
          if (!refreshed) continue;
          accessToken = refreshed;
          await supabase.from("user_google_tokens").update({
            access_token: accessToken,
            token_expiry: new Date(Date.now() + 3500 * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("user_id", tk.user_id);
        }

        let calendarIds: string[] = tk.selected_calendars || [];
        if (calendarIds.length === 0) {
          const lr = await fetch("https://www.googleapis.com/calendar/v3/users/me/calendarList", {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (lr.ok) {
            const ld = await lr.json();
            const primary = ld.items?.find((c: any) => c.primary);
            if (primary) calendarIds = [primary.id];
          }
        }

        const userEvents: any[] = [];
        for (const calId of calendarIds) {
          const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`;
          const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
          if (!r.ok) continue;
          const d = await r.json();
          userEvents.push(...(d.items || []).filter((e: any) => e.status !== "cancelled"));
        }

        // Filter JetHr
        const jethrEvents = userEvents.filter((e) => isJethrEvent(e, detection));

        // Profile for Slack message
        const { data: profile } = await supabase
          .from("profiles")
          .select("first_name, last_name, email")
          .eq("id", tk.user_id)
          .maybeSingle();
        const userName = profile
          ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.email
          : "Utente";

        for (const ev of jethrEvents) {
          const startISO = ev.start?.dateTime || ev.start?.date;
          const endISO = ev.end?.dateTime || ev.end?.date;
          if (!startISO || !endISO) continue;
          const allDay = !ev.start?.dateTime;

          // Check existing
          const { data: existing } = await supabase
            .from("activity_time_tracking")
            .select("id")
            .eq("google_event_id", ev.id)
            .limit(1);
          if (existing && existing.length > 0) continue;

          const mapping = resolveMapping(ev, mappingList);
          if (!mapping) {
            await supabase.from("jethr_auto_link_log").insert({
              user_id: tk.user_id, google_event_id: ev.id, status: "skipped", error: "no_mapping",
            });
            continue;
          }

          const times = extractTimes(ev, defaultTimes);
          const days = daysBetween(startISO, endISO, allDay);

          const inserted: string[] = [];
          for (const day of days) {
            const startTs = new Date(`${day}T${times.start}:00`).toISOString();
            const endTs = new Date(`${day}T${times.end}:00`).toISOString();
            const { data: ins, error: insErr } = await supabase
              .from("activity_time_tracking")
              .insert({
                budget_item_id: mapping.budget_item_id,
                user_id: tk.user_id,
                scheduled_date: day,
                scheduled_start_time: times.start,
                scheduled_end_time: times.end,
                actual_start_time: startTs,
                actual_end_time: endTs,
                google_event_id: days.length > 1 ? `${ev.id}__${day}` : ev.id,
                google_event_title: ev.summary || "",
                notes: `[JetHr] ${(ev.description || "").slice(0, 280)}`,
              })
              .select("id")
              .single();
            if (insErr) {
              await supabase.from("jethr_auto_link_log").insert({
                user_id: tk.user_id, google_event_id: ev.id, status: "error", error: insErr.message,
              });
            } else if (ins) {
              inserted.push(ins.id);
            }
          }

          if (inserted.length > 0) {
            await supabase.from("jethr_auto_link_log").insert({
              user_id: tk.user_id,
              google_event_id: ev.id,
              budget_item_id: mapping.budget_item_id,
              tracking_id: inserted[0],
              status: "created",
            });

            // Slack notification
            if (slackChannel) {
              const startLabel = new Date(startISO).toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short" });
              const endLabel = new Date(new Date(endISO).getTime() - (allDay ? 24 * 3600 * 1000 : 0))
                .toLocaleDateString("it-IT", { weekday: "short", day: "2-digit", month: "short" });
              const label = ev.summary || "Assenza";
              const text = `🌴 ${userName} — ${label} dal ${startLabel} al ${endLabel} (${days.length} giorni). Da JetHr.`;
              await sendSlackMessage(slackChannel, text, [
                { type: "section", text: { type: "mrkdwn", text: `🌴 *${userName}* — *${label}*\nDal *${startLabel}* al *${endLabel}* (${days.length} ${days.length === 1 ? "giorno" : "giorni"})\n_Pianificato automaticamente da JetHr._` } },
              ]);
            }
            results.push({ user_id: tk.user_id, event_id: ev.id, days: days.length });
          }
        }
      } catch (e) {
        console.error(`User ${tk.user_id} error:`, e);
        results.push({ user_id: tk.user_id, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("jethr-auto-link-events error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
