import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from '../_shared/mandrill.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function isWorkingDay(supabase: any, dateStr: string): Promise<boolean> {
  const date = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = date.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) return false;

  const { data: closure } = await supabase
    .from("company_closure_days")
    .select("id")
    .eq("date", dateStr)
    .maybeSingle();

  return !closure;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate CRON_SECRET for scheduled invocations
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeader = req.headers.get("Authorization");
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if today is Thursday
    const today = new Date();
    if (today.getDay() !== 4) {
      console.log("Today is not Thursday. Skipping.");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Not Thursday" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if today is a working day
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const isWorking = await isWorkingDay(supabase, todayStr);

    if (!isWorking) {
      console.log("Today is Thursday but not a working day. Skipping.");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Thursday but closure day" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Today is a working Thursday. Sending planning reminders...");

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .eq("approved", true)
      .is("deleted_at", null)
      .not("email", "is", null);

    if (profilesError) throw profilesError;

    // Calculate next week range for the message
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + (7 - today.getDay() + 1));
    const nextFriday = new Date(nextMonday);
    nextFriday.setDate(nextMonday.getDate() + 4);

    const formatDate = (d: Date) => `${d.getDate()}/${d.getMonth() + 1}`;
    const weekRange = `${formatDate(nextMonday)} - ${formatDate(nextFriday)}`;

    // Create in-app notifications
    const notificationsToCreate = (profiles || []).map((p: any) => ({
      user_id: p.id,
      type: "weekly_planning_reminder",
      title: "Pianifica la settimana prossima",
      message: `Ricordati di pianificare le tue attività nel calendario per la prossima settimana (${weekRange}).`,
    }));

    if (notificationsToCreate.length > 0) {
      const { error: insertError } = await supabase.from("notifications").insert(notificationsToCreate);
      if (insertError) console.error("Error creating in-app notifications:", insertError);
      else console.log(`Created ${notificationsToCreate.length} in-app notifications`);
    }

    // Send emails
    let emailsSent = 0;
    const mandrillKey = Deno.env.get("MANDRILL_API_KEY");

    if (mandrillKey) {
      for (const profile of profiles || []) {
        if (!profile.email) continue;

        const { data: pref } = await supabase
          .from("notification_preferences")
          .select("email_enabled")
          .eq("user_id", profile.id)
          .eq("notification_type", "weekly_planning_reminder")
          .maybeSingle();

        if (pref && pref.email_enabled === false) continue;

        const userName = profile.first_name
          ? `${profile.first_name}${profile.last_name ? ' ' + profile.last_name : ''}`
          : 'Utente';

        try {
          await sendEmail({
            from_email: 'noreply@timetrap.it',
            from_name: 'TimeTrap',
            to: [profile.email],
            subject: `Pianifica le attività — settimana ${weekRange}`,
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
                    <h2 style="color: #1a3330; font-size: 22px; font-weight: 700; margin: 0 0 16px;">🗓️ Pianifica la Settimana Prossima</h2>
                    <p style="font-size: 15px;">Ciao <strong>${userName}</strong>,</p>
                    <p style="font-size: 15px;">Ti ricordiamo di pianificare le tue attività nel calendario per la prossima settimana.</p>
                    <div style="background-color: #f2f8f6; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #cce5df; text-align: center;">
                      <p style="margin: 0; font-size: 18px; font-weight: 700; color: #3dbeaa;">Settimana ${weekRange}</p>
                    </div>
                    <p style="font-size: 15px;">Accedi alla piattaforma per organizzare e distribuire le attività sui giorni lavorativi.</p>
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

    console.log(`Weekly planning reminder complete: ${notificationsToCreate.length} in-app, ${emailsSent} emails`);

    return new Response(
      JSON.stringify({ success: true, inAppNotifications: notificationsToCreate.length, emailsSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-weekly-planning-reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
