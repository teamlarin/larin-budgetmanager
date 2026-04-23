import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface FailedRun {
  jobid: number;
  runid: number;
  jobname: string | null;
  status: string;
  return_message: string | null;
  start_time: string;
  end_time: string | null;
}

const ROME_TZ = "Europe/Rome";

function fmtRome(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("it-IT", {
      timeZone: ROME_TZ,
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function shortError(msg: string | null): string {
  if (!msg) return "(nessun messaggio)";
  const firstLine = msg.split("\n")[0].trim();
  return firstLine.length > 400 ? firstLine.slice(0, 400) + "…" : firstLine;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth: accept either CRON_SECRET (cron) or service-role
  const authHeader = req.headers.get("Authorization") || "";
  const cronSecret = Deno.env.get("CRON_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const isAuthorized =
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    authHeader === `Bearer ${serviceKey}`;

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
  const slackWebhook = Deno.env.get("SLACK_WEBHOOK_URL");

  try {
    // 1. Get failed runs from last 6 hours via SECURITY DEFINER RPC won't work
    //    (RPC is admin-only). We use service-role direct query through a helper:
    //    cron schema is not exposed to PostgREST. So we create a one-off SQL via
    //    a SECURITY DEFINER function callable by service role too.
    //    Simpler: query using the new admin_get_cron_runs function but bypass
    //    the role check by using a service-role-only variant.
    //    => We embed the query as raw SQL via execute_readonly_query (already exists).
    const queryText = `
      SELECT d.jobid, d.runid, j.jobname, d.status::text AS status,
             d.return_message, d.start_time::text AS start_time,
             d.end_time::text AS end_time
      FROM cron.job_run_details d
      LEFT JOIN cron.job j ON j.jobid = d.jobid
      WHERE d.status::text = 'failed'
        AND d.start_time > now() - interval '6 hours'
      ORDER BY d.start_time DESC
      LIMIT 50
    `;

    const { data: rawData, error: qErr } = await supabase.rpc("execute_readonly_query", {
      query_text: queryText,
    });
    if (qErr) throw qErr;

    const failedRuns: FailedRun[] = Array.isArray(rawData) ? rawData : [];
    console.log(`[monitor-cron-failures] Found ${failedRuns.length} failed runs in last 6h`);

    if (failedRuns.length === 0) {
      return new Response(JSON.stringify({ checked: 0, notified: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Filter out already-notified ones
    const keys = failedRuns.map(r => `${r.jobid}-${r.runid}`);
    const { data: existing } = await supabase
      .from("cron_failure_notifications")
      .select("jobid, runid")
      .in("jobid", failedRuns.map(r => r.jobid));

    const existingKeys = new Set((existing || []).map(e => `${e.jobid}-${e.runid}`));
    const newFailures = failedRuns.filter(r => !existingKeys.has(`${r.jobid}-${r.runid}`));

    console.log(`[monitor-cron-failures] ${newFailures.length} new failures to notify`);

    if (newFailures.length === 0) {
      return new Response(JSON.stringify({ checked: failedRuns.length, notified: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Group by jobname for one Slack message per job
    const byJob = new Map<string, FailedRun[]>();
    for (const r of newFailures) {
      const k = r.jobname || `job-${r.jobid}`;
      if (!byJob.has(k)) byJob.set(k, []);
      byJob.get(k)!.push(r);
    }

    let notifiedCount = 0;

    if (slackWebhook) {
      const blocks: any[] = [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `🚨 Cron job falliti (${newFailures.length})`,
            emoji: true,
          },
        },
      ];

      for (const [jobname, runs] of byJob.entries()) {
        const last = runs[0];
        blocks.push({
          type: "section",
          text: {
            type: "mrkdwn",
            text:
              `*${jobname}* — ${runs.length} fallimento${runs.length > 1 ? "i" : ""}\n` +
              `_Ultimo:_ ${fmtRome(last.start_time)}\n` +
              "```" + shortError(last.return_message) + "```",
          },
        });
      }

      blocks.push({
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `Monitor automatico cron · ${fmtRome(new Date().toISOString())}`,
          },
        ],
      });

      const slackResp = await fetch(slackWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚨 ${newFailures.length} cron job falliti`,
          blocks,
        }),
      });

      if (!slackResp.ok) {
        const err = await slackResp.text();
        console.error("[monitor-cron-failures] Slack error:", err);
      } else {
        notifiedCount = newFailures.length;
      }
    } else {
      console.warn("[monitor-cron-failures] SLACK_WEBHOOK_URL not configured, skipping Slack");
    }

    // 4. Record notifications (even if Slack failed, to avoid spam loops)
    const rows = newFailures.map(r => ({
      jobid: r.jobid,
      runid: r.runid,
      jobname: r.jobname || `job-${r.jobid}`,
      failed_at: r.start_time,
      error_message: r.return_message,
    }));
    const { error: insErr } = await supabase
      .from("cron_failure_notifications")
      .upsert(rows, { onConflict: "jobid,runid" });
    if (insErr) console.error("[monitor-cron-failures] insert error:", insErr);

    return new Response(
      JSON.stringify({ checked: failedRuns.length, notified: notifiedCount, jobs: Array.from(byJob.keys()) }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("[monitor-cron-failures] error:", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
