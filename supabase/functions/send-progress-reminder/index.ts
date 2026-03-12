import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from '../_shared/mandrill.ts';

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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting weekly progress reminder...");

    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, name, user_id, project_leader_id, billing_type, clients(name)")
      .eq("status", "approvato")
      .in("project_status", ["in_partenza", "aperto", "da_fatturare"])
      .not("user_id", "is", null);

    if (projectsError) throw projectsError;

    console.log(`Found ${projects?.length || 0} active projects`);

    const leaderProjects: Record<string, { id: string; name: string; clientName?: string }[]> = {};

    for (const project of projects || []) {
      const leaderId = project.project_leader_id || project.user_id;
      if (!leaderId) continue;
      if (!leaderProjects[leaderId]) leaderProjects[leaderId] = [];
      leaderProjects[leaderId].push({
        id: project.id,
        name: project.name,
        clientName: project.clients?.name,
      });
    }

    const leaderIds = Object.keys(leaderProjects);

    if (leaderIds.length === 0) {
      return new Response(
        JSON.stringify({ success: true, notificationsSent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .in("id", leaderIds);

    if (profilesError) throw profilesError;

    const profilesMap: Record<string, { email: string; firstName?: string; lastName?: string }> = {};
    for (const p of profiles || []) {
      if (p.email) {
        profilesMap[p.id] = { email: p.email, firstName: p.first_name || undefined, lastName: p.last_name || undefined };
      }
    }

    const notificationsToCreate = leaderIds.map((leaderId) => ({
      user_id: leaderId,
      type: "progress_reminder",
      title: "Promemoria aggiornamento progresso",
      message: `Ricordati di aggiornare il progresso dei tuoi ${leaderProjects[leaderId].length} progett${leaderProjects[leaderId].length === 1 ? 'o' : 'i'} attiv${leaderProjects[leaderId].length === 1 ? 'o' : 'i'}.`,
    }));

    const { error: insertError } = await supabase.from("notifications").insert(notificationsToCreate);
    if (insertError) console.error("Error creating in-app notifications:", insertError);
    else console.log(`Created ${notificationsToCreate.length} in-app notifications`);

    let emailsSent = 0;
    const mandrillKey = Deno.env.get("MANDRILL_API_KEY");

    if (mandrillKey) {
      for (const leaderId of leaderIds) {
        const profile = profilesMap[leaderId];
        if (!profile?.email) continue;

        const projects = leaderProjects[leaderId];
        const userName = profile.firstName
          ? `${profile.firstName}${profile.lastName ? ' ' + profile.lastName : ''}`
          : 'Utente';

        const projectListHtml = projects
          .map((p) => `<li><strong>${p.name}</strong>${p.clientName ? ` <span style="color:#666;">(${p.clientName})</span>` : ''}</li>`)
          .join("");

        try {
          await sendEmail({
            from_email: 'noreply@timetrap.it',
            from_name: 'TimeTrap',
            to: [profile.email],
            subject: `Promemoria: aggiorna il progresso dei tuoi progetti`,
            html: `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap" rel="stylesheet">
              </head>
              <body style="font-family: Manrope, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a3330; margin: 0; padding: 20px; background-color: #f2f8f6;">
                <div style="max-width: 600px; margin: 0 auto; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 25px -8px rgba(61,190,170,0.25);">
                  <div style="background: linear-gradient(135deg, #3dbeaa, #fac320); padding: 30px 40px; text-align: center;">
                    <h1 style="color: #ffffff; font-size: 28px; font-weight: 700; margin: 0;">TimeTrap</h1>
                  </div>
                  <div style="background-color: #ffffff; padding: 32px 40px;">
                    <h2 style="color: #1a3330; font-size: 22px; font-weight: 700; margin: 0 0 16px;">📊 Aggiornamento Progresso Settimanale</h2>
                    <p style="font-size: 15px;">Ciao <strong>${userName}</strong>,</p>
                    <p style="font-size: 15px;">Ti ricordiamo di aggiornare il progresso dei tuoi progetti attivi:</p>
                    <div style="background-color: #f2f8f6; border-radius: 12px; padding: 16px 20px; margin: 20px 0; border: 1px solid #cce5df;">
                      <ul style="margin: 0; padding-left: 20px;">${projectListHtml}</ul>
                    </div>
                    <p style="font-size: 15px;">Accedi alla piattaforma per aggiornare lo stato di avanzamento di ciascun progetto.</p>
                  </div>
                  <div style="background-color: #f2f8f6; padding: 20px 40px; text-align: center; border-top: 1px solid #cce5df;">
                    <p style="color: #527a73; font-size: 12px; margin: 0;">TimeTrap — Gestione Progetti e Budget</p>
                  </div>
                </div>
              </body>
              </html>
            `,
          });
          emailsSent++;
        } catch (emailError) {
          console.error(`Error sending email to ${profile.email}:`, emailError);
        }
      }
    } else {
      console.warn("MANDRILL_API_KEY not configured, skipping emails");
    }

    console.log(`Progress reminder complete: ${notificationsToCreate.length} in-app, ${emailsSent} emails`);

    return new Response(
      JSON.stringify({ success: true, inAppNotifications: notificationsToCreate.length, emailsSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-progress-reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
