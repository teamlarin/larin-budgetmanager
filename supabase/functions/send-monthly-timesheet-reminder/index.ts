import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { sendEmail } from '../_shared/mandrill.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Checks if today is the last working day of the month.
 * Considers weekends (Sat/Sun) and company closure days.
 */
async function isLastWorkingDayOfMonth(supabase: any): Promise<boolean> {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  // Get company closure days for this month
  const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0);
  const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

  const { data: closureDays } = await supabase
    .from("company_closure_days")
    .select("date")
    .gte("date", monthStart)
    .lte("date", monthEnd);

  const closureDatesSet = new Set(
    (closureDays || []).map((d: any) => d.date)
  );

  // Find the last working day of the month
  let candidate = new Date(year, month + 1, 0); // last calendar day
  while (candidate.getDate() >= 1) {
    const dayOfWeek = candidate.getDay();
    const dateStr = `${candidate.getFullYear()}-${String(candidate.getMonth() + 1).padStart(2, '0')}-${String(candidate.getDate()).padStart(2, '0')}`;
    
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isClosure = closureDatesSet.has(dateStr);

    if (!isWeekend && !isClosure) {
      // This is the last working day
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      return dateStr === todayStr;
    }
    candidate.setDate(candidate.getDate() - 1);
  }

  return false;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate CRON_SECRET for scheduled invocations
    const cronSecret = Deno.env.get("CRON_SECRET");
    const authHeaderCron = req.headers.get("Authorization");
    if (!cronSecret || authHeaderCron !== `Bearer ${cronSecret}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Checking if today is the last working day of the month...");

    const isLastDay = await isLastWorkingDayOfMonth(supabase);

    if (!isLastDay) {
      console.log("Today is NOT the last working day. Skipping.");
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Not the last working day of the month" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Today IS the last working day of the month. Sending reminders...");

    // Get all active, approved users
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name")
      .eq("approved", true)
      .is("deleted_at", null)
      .not("email", "is", null);

    if (profilesError) throw profilesError;

    const now = new Date();
    const monthNames = [
      "Gennaio", "Febbraio", "Marzo", "Aprile", "Maggio", "Giugno",
      "Luglio", "Agosto", "Settembre", "Ottobre", "Novembre", "Dicembre"
    ];
    const currentMonthName = monthNames[now.getMonth()];
    const currentYear = now.getFullYear();

    // Create in-app notifications for all users
    const notificationsToCreate = (profiles || []).map((p: any) => ({
      user_id: p.id,
      type: "monthly_timesheet_check",
      title: "Verifica inserimenti calendario",
      message: `Ricordati di verificare i tuoi inserimenti delle attività nel calendario per il mese di ${currentMonthName} ${currentYear}.`,
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

        // Check email preference
        const { data: pref } = await supabase
          .from("notification_preferences")
          .select("email_enabled")
          .eq("user_id", profile.id)
          .eq("notification_type", "monthly_timesheet_check")
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
            subject: `Verifica inserimenti calendario — ${currentMonthName} ${currentYear}`,
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
                    <h2 style="color: #1a3330; font-size: 22px; font-weight: 700; margin: 0 0 16px;">📅 Verifica Inserimenti Calendario</h2>
                    <p style="font-size: 15px;">Ciao <strong>${userName}</strong>,</p>
                    <p style="font-size: 15px;">Oggi è l'ultimo giorno lavorativo di <strong>${currentMonthName} ${currentYear}</strong>.</p>
                    <div style="background-color: #f2f8f6; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #cce5df;">
                      <p style="margin: 0; font-size: 15px;">Ti chiediamo di verificare che tutti i tuoi inserimenti delle attività nel calendario siano corretti e completi per questo mese.</p>
                    </div>
                    <p style="font-size: 15px;">Accedi alla piattaforma per controllare e confermare le tue ore.</p>
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

    console.log(`Monthly timesheet reminder complete: ${notificationsToCreate.length} in-app, ${emailsSent} emails`);

    return new Response(
      JSON.stringify({ success: true, inAppNotifications: notificationsToCreate.length, emailsSent }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-monthly-timesheet-reminder:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
