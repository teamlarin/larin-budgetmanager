import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from "../_shared/mandrill.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const today = new Date().toISOString().split("T")[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0];
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];

    console.log("Starting weekly AI summary...");

    // Gather data via execute_readonly_query
    const queries: Record<string, string> = {
      active_projects: `
        SELECT p.id, p.name, p.progress, p.project_status, p.end_date, p.total_hours, p.total_budget,
               p.billing_type, p.status, c.name as client_name,
               prof.first_name || ' ' || prof.last_name as leader_name
        FROM public.projects p
        LEFT JOIN public.clients c ON c.id = p.client_id
        LEFT JOIN public.profiles prof ON prof.id = p.project_leader_id
        WHERE p.status = 'approvato'
          AND p.project_status IN ('in_partenza', 'aperto', 'da_fatturare')
        ORDER BY p.end_date ASC NULLS LAST
        LIMIT 50
      `,
      completed_this_week: `
        SELECT p.name, c.name as client_name, p.status_changed_at
        FROM public.projects p
        LEFT JOIN public.clients c ON c.id = p.client_id
        WHERE p.status = 'completato'
          AND p.status_changed_at >= '${weekAgo}'
        ORDER BY p.status_changed_at DESC
        LIMIT 20
      `,
      at_risk_projects: `
        SELECT p.name, p.project_status, p.progress, p.end_date, c.name as client_name,
               prof.first_name || ' ' || prof.last_name as leader_name
        FROM public.projects p
        LEFT JOIN public.clients c ON c.id = p.client_id
        LEFT JOIN public.profiles prof ON prof.id = p.project_leader_id
        WHERE p.status = 'approvato'
          AND p.project_status IN ('at_risk', 'blocked')
        LIMIT 20
      `,
      upcoming_deadlines: `
        SELECT p.name, p.end_date, p.progress, c.name as client_name
        FROM public.projects p
        LEFT JOIN public.clients c ON c.id = p.client_id
        WHERE p.status = 'approvato'
          AND p.end_date IS NOT NULL
          AND p.end_date <= '${nextWeek}'
          AND p.end_date >= '${today}'
        ORDER BY p.end_date ASC
        LIMIT 15
      `,
      hours_summary: `
        SELECT 
          COALESCE(SUM(EXTRACT(EPOCH FROM (att.actual_end_time - att.actual_start_time)) / 3600), 0) as confirmed_hours,
          COUNT(DISTINCT att.user_id) as active_users
        FROM public.activity_time_tracking att
        WHERE att.actual_start_time IS NOT NULL
          AND att.actual_end_time IS NOT NULL
          AND att.scheduled_date >= '${weekAgo}'
          AND att.scheduled_date <= '${today}'
      `,
      progress_updates: `
        SELECT pu.progress_value, pu.update_text, pu.roadblocks_text,
               p.name as project_name
        FROM public.project_progress_updates pu
        JOIN public.projects p ON p.id = pu.project_id
        WHERE pu.created_at >= '${weekAgo}'
        ORDER BY pu.created_at DESC
        LIMIT 30
      `,
    };

    const queryResults: Record<string, any> = {};
    for (const [label, sql] of Object.entries(queries)) {
      try {
        const pgRes = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_readonly_query`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: supabaseAnonKey,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({ query_text: sql.trim().replace(/;+$/g, "") }),
        });
        if (pgRes.ok) {
          queryResults[label] = await pgRes.json();
        } else {
          console.error(`Query [${label}] failed:`, await pgRes.text());
          queryResults[label] = [];
        }
      } catch (e) {
        console.error(`Query [${label}] error:`, e);
        queryResults[label] = [];
      }
    }

    // Call AI for structured weekly summary
    const systemPrompt = `Sei un assistente AI per TimeTrap. Genera un riepilogo settimanale strutturato in italiano.
Data odierna: ${today}.

Il riepilogo deve includere queste sezioni:
- overview: panoramica generale (2-3 frasi)
- achievements: milestone e risultati raggiunti questa settimana
- risks: progetti a rischio o bloccati con dettagli
- deadlines: scadenze imminenti
- recommendations: 2-3 azioni consigliate per la settimana

Sii specifico con nomi di progetti, clienti e numeri. Formatta in modo conciso.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Dati della settimana:\n\n${JSON.stringify(queryResults, null, 2)}` },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_weekly_summary",
              description: "Generate a structured weekly summary for TimeTrap",
              parameters: {
                type: "object",
                properties: {
                  overview: { type: "string", description: "2-3 sentence overview" },
                  achievements: {
                    type: "array",
                    items: { type: "string" },
                    description: "List of achievements/milestones",
                  },
                  risks: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        project: { type: "string" },
                        issue: { type: "string" },
                      },
                      required: ["project", "issue"],
                    },
                  },
                  deadlines: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        project: { type: "string" },
                        date: { type: "string" },
                        progress: { type: "string" },
                      },
                      required: ["project", "date"],
                    },
                  },
                  recommendations: {
                    type: "array",
                    items: { type: "string" },
                    description: "2-3 actionable recommendations",
                  },
                },
                required: ["overview", "achievements", "risks", "deadlines", "recommendations"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_weekly_summary" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error(`AI gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    if (!toolCall?.function?.arguments) {
      throw new Error("AI did not return structured summary");
    }

    const summary = JSON.parse(toolCall.function.arguments);
    console.log("AI summary generated:", JSON.stringify(summary).slice(0, 200));

    // Build notification message
    const notifParts: string[] = [
      `📊 ${summary.overview}`,
    ];

    if (summary.achievements?.length > 0) {
      notifParts.push(`\n✅ Risultati: ${summary.achievements.join('; ')}`);
    }
    if (summary.risks?.length > 0) {
      notifParts.push(
        `\n⚠️ Rischi: ${summary.risks.map((r: any) => `${r.project}: ${r.issue}`).join('; ')}`
      );
    }
    if (summary.deadlines?.length > 0) {
      notifParts.push(
        `\n📅 Scadenze: ${summary.deadlines.map((d: any) => `${d.project} (${d.date})`).join('; ')}`
      );
    }
    if (summary.recommendations?.length > 0) {
      notifParts.push(`\n💡 Suggerimenti: ${summary.recommendations.join('; ')}`);
    }

    const notifMessage = notifParts.join('');

    // Get recipients: admin, team_leader, account, coordinator
    const { data: recipients } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("role", ["admin", "team_leader", "account", "coordinator"]);

    if (!recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nessun destinatario trovato" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter approved users
    const { data: approvedProfiles } = await supabase
      .from("profiles")
      .select("id, email, first_name")
      .in("id", recipients.map((r) => r.user_id))
      .eq("approved", true)
      .is("deleted_at", null);

    if (!approvedProfiles || approvedProfiles.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nessun utente approvato trovato" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send emails only (no in-app notifications for weekly AI summary)

    // Send emails
    let emailsSent = 0;
    for (const profile of approvedProfiles) {
      if (!profile.email) continue;

      // Check email preference
      const { data: pref } = await supabase
        .from("notification_preferences")
        .select("email_enabled")
        .eq("user_id", profile.id)
        .eq("notification_type", "weekly_ai_summary")
        .maybeSingle();

      if (pref && pref.email_enabled === false) continue;

      try {
        await sendEmail({
          from_email: "noreply@timetrap.it",
          from_name: "TimeTrap",
          to: [profile.email],
          subject: "📊 Riepilogo Settimanale AI — TimeTrap",
          html: buildEmailHtml(profile.first_name || "Utente", summary),
        });
        emailsSent++;
      } catch (e) {
        console.error(`Email error for ${profile.email}:`, e);
      }
    }

    console.log(`Sent ${emailsSent} emails`);

    return new Response(
      JSON.stringify({
        success: true,
        notifications: notifications.length,
        emails: emailsSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Weekly AI summary error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function buildEmailHtml(userName: string, summary: any): string {
  const achievements = (summary.achievements || [])
    .map((a: string) => `<li style="margin-bottom:4px;">${a}</li>`)
    .join("");

  const risks = (summary.risks || [])
    .map((r: any) => `<li style="margin-bottom:4px;"><strong>${r.project}</strong>: ${r.issue}</li>`)
    .join("");

  const deadlines = (summary.deadlines || [])
    .map((d: any) => `<li style="margin-bottom:4px;"><strong>${d.project}</strong> — ${d.date}${d.progress ? ` (${d.progress})` : ""}</li>`)
    .join("");

  const recommendations = (summary.recommendations || [])
    .map((r: string) => `<li style="margin-bottom:4px;">${r}</li>`)
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:'Manrope',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#0d9488,#d4a843);padding:24px 32px;">
          <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">📊 Riepilogo Settimanale AI</h1>
          <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">TimeTrap — ${new Date().toLocaleDateString("it-IT", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:24px 32px;">
          <p style="margin:0 0 16px;color:#374151;font-size:14px;">Ciao <strong>${userName}</strong>,</p>
          <p style="margin:0 0 20px;color:#374151;font-size:14px;line-height:1.6;">${summary.overview || ""}</p>

          ${achievements ? `
          <div style="margin-bottom:20px;">
            <h2 style="margin:0 0 8px;color:#0d9488;font-size:15px;font-weight:700;">✅ Risultati della settimana</h2>
            <ul style="margin:0;padding-left:20px;color:#374151;font-size:13px;line-height:1.6;">${achievements}</ul>
          </div>` : ""}

          ${risks ? `
          <div style="margin-bottom:20px;padding:12px 16px;background-color:#fef2f2;border-radius:8px;border-left:4px solid #ef4444;">
            <h2 style="margin:0 0 8px;color:#dc2626;font-size:15px;font-weight:700;">⚠️ Progetti a rischio</h2>
            <ul style="margin:0;padding-left:20px;color:#374151;font-size:13px;line-height:1.6;">${risks}</ul>
          </div>` : ""}

          ${deadlines ? `
          <div style="margin-bottom:20px;">
            <h2 style="margin:0 0 8px;color:#d4a843;font-size:15px;font-weight:700;">📅 Scadenze imminenti</h2>
            <ul style="margin:0;padding-left:20px;color:#374151;font-size:13px;line-height:1.6;">${deadlines}</ul>
          </div>` : ""}

          ${recommendations ? `
          <div style="margin-bottom:20px;padding:12px 16px;background-color:#f0fdfa;border-radius:8px;border-left:4px solid #0d9488;">
            <h2 style="margin:0 0 8px;color:#0d9488;font-size:15px;font-weight:700;">💡 Suggerimenti</h2>
            <ul style="margin:0;padding-left:20px;color:#374151;font-size:13px;line-height:1.6;">${recommendations}</ul>
          </div>` : ""}
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 32px;background-color:#f9fafb;border-top:1px solid #e5e7eb;">
          <p style="margin:0;color:#9ca3af;font-size:11px;text-align:center;">Generato automaticamente da TimeTrap AI • Questo riepilogo è basato sui dati della settimana precedente</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
