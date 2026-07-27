import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Add N months to a date, then add offsetDays. Returns a UTC Date.
function addMonthsAndDays(startISO: string, months: number, offsetDays: number): Date {
  const d = new Date(startISO);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth();
  const day = d.getUTCDate();
  const target = new Date(Date.UTC(year, month + months, day));
  target.setUTCDate(target.getUTCDate() + offsetDays);
  return target;
}

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("Authorization");

    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;
    const isServiceRole = authHeader === `Bearer ${supabaseServiceKey}`;

    if (!isCron && !isServiceRole) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Webhook URL
    const { data: webhookSetting } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "make_webhook_project_completed")
      .maybeSingle();

    const webhookUrl = webhookSetting?.setting_value?.url;
    if (!webhookUrl) {
      return new Response(
        JSON.stringify({ message: "No webhook URL configured" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Recurring projects with a start_date and not completed
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select(`
        id,
        name,
        start_date,
        end_date,
        account_user_id,
        project_leader_id,
        project_status,
        billing_type,
        client:clients(name, strategic_level),
        contact:client_contacts(first_name, last_name, email)
      `)
      .eq("billing_type", "recurring")
      .neq("project_status", "completato")
      .not("start_date", "is", null);

    if (projectsError) {
      console.error("Error fetching projects:", projectsError);
      return new Response(JSON.stringify({ error: projectsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Existing logs
    const projectIds = (projects || []).map((p: any) => p.id);
    let existingLogs: { project_id: string; quarter_number: number }[] = [];
    if (projectIds.length > 0) {
      const { data: logs } = await supabase
        .from("project_quarter_webhook_log")
        .select("project_id, quarter_number")
        .in("project_id", projectIds);
      existingLogs = logs || [];
    }
    const sentSet = new Set(
      existingLogs.map((l) => `${l.project_id}__${l.quarter_number}`)
    );

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const results: any[] = [];

    for (const project of projects || []) {
      if (!project.start_date) continue;

      // Cache account & leader names
      let accountName: string | undefined;
      let projectLeaderName: string | undefined;
      let namesFetched = false;

      // Compute the max N to consider: up to today (and bounded by end_date if present)
      const endBound = project.end_date ? new Date(project.end_date) : null;
      if (endBound) endBound.setUTCHours(0, 0, 0, 0);

      for (let n = 1; n <= 200; n++) {
        // trigger date = start_date + n*3 months + 15 days
        const triggerDate = addMonthsAndDays(project.start_date, n * 3, 15);
        if (triggerDate > today) break;

        // period start/end (without offset)
        const periodStart = addMonthsAndDays(project.start_date, (n - 1) * 3, 0);
        const periodEnd = addMonthsAndDays(project.start_date, n * 3, 0);

        // If project has end_date and periodEnd is after it, skip further quarters
        if (endBound && periodEnd > endBound) break;

        const key = `${project.id}__${n}`;
        if (sentSet.has(key)) continue;

        if (!namesFetched) {
          if (project.account_user_id) {
            const { data: accountUser } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("id", project.account_user_id)
              .maybeSingle();
            if (accountUser) {
              accountName = `${accountUser.first_name || ""} ${accountUser.last_name || ""}`.trim();
            }
          }
          if (project.project_leader_id) {
            const { data: leaderUser } = await supabase
              .from("profiles")
              .select("first_name, last_name")
              .eq("id", project.project_leader_id)
              .maybeSingle();
            if (leaderUser) {
              projectLeaderName = `${leaderUser.first_name || ""} ${leaderUser.last_name || ""}`.trim();
            }
          }
          namesFetched = true;
        }

        const payload = {
          event_type: "recurring_quarter_close",
          project_id: project.id,
          project_name: project.name,
          client_name: project.client?.name || undefined,
          client_strategic_level: project.client?.strategic_level ?? null,
          account_name: accountName,
          project_leader_name: projectLeaderName,
          contact_first_name: project.contact?.first_name || undefined,
          contact_last_name: project.contact?.last_name || undefined,
          contact_email: project.contact?.email || undefined,
          quarter_number: n,
          quarter_label: `Q${n}`,
          quarter_period_start: toDateOnly(periodStart),
          quarter_period_end: toDateOnly(periodEnd),
          quarter_trigger_date: toDateOnly(triggerDate),
          project_start_date: project.start_date,
        };

        let status = 0;
        let responseText = "";
        try {
          const resp = await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          status = resp.status;
          responseText = (await resp.text()).slice(0, 500);
        } catch (err) {
          console.error(`Webhook POST error for ${project.id} Q${n}:`, err);
          responseText = String(err).slice(0, 500);
        }

        if (status >= 200 && status < 300) {
          await supabase.from("project_quarter_webhook_log").insert({
            project_id: project.id,
            quarter_number: n,
            trigger_date: toDateOnly(triggerDate),
            webhook_status: status,
            webhook_response: responseText,
          });
          sentSet.add(key);
          results.push({ project_id: project.id, quarter: n, status });
        } else {
          console.error(
            `Webhook failed for ${project.id} Q${n}: ${status} ${responseText}`
          );
          results.push({
            project_id: project.id,
            quarter: n,
            status,
            error: responseText,
          });
          // Do not log, so it retries next run
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        projects_scanned: projects?.length || 0,
        triggers_sent: results.filter((r) => r.status >= 200 && r.status < 300).length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-recurring-quarter-webhook:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
