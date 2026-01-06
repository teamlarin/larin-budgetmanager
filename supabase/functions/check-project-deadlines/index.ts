import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Project {
  id: string;
  name: string;
  end_date: string;
  user_id: string;
  account_user_id: string | null;
  project_status: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate CRON_SECRET for scheduled invocations
    const authHeader = req.headers.get("Authorization");
    const cronSecret = Deno.env.get("CRON_SECRET");
    
    if (!cronSecret) {
      console.error("CRON_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Server misconfigured: CRON_SECRET not set" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }
    
    const expectedAuth = `Bearer ${cronSecret}`;
    if (authHeader !== expectedAuth) {
      console.error("Unauthorized: Invalid or missing CRON_SECRET");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting deadline check...");

    // Get all active projects with end_date
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, name, end_date, user_id, account_user_id, project_status")
      .eq("status", "approvato")
      .in("project_status", ["in_partenza", "aperto", "da_fatturare"])
      .not("end_date", "is", null);

    if (projectsError) {
      console.error("Error fetching projects:", projectsError);
      throw projectsError;
    }

    console.log(`Found ${projects?.length || 0} projects with deadlines`);

    const now = new Date();
    const notificationsToCreate = [];

    for (const project of projects as Project[]) {
      const endDate = new Date(project.end_date);
      const daysUntilDeadline = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      console.log(`Project ${project.name}: ${daysUntilDeadline} days until deadline`);

      // Check if deadline is overdue
      if (daysUntilDeadline < 0) {
        // Check if notification already exists for this project (overdue)
        const { data: existingNotif } = await supabase
          .from("notifications")
          .select("id")
          .eq("project_id", project.id)
          .eq("type", "deadline_overdue")
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (!existingNotif) {
          // Notify project leader
          notificationsToCreate.push({
            user_id: project.user_id,
            project_id: project.id,
            type: "deadline_overdue",
            title: "Scadenza Superata",
            message: `Il progetto "${project.name}" ha superato la data di scadenza di ${Math.abs(daysUntilDeadline)} giorni.`,
          });

          // Notify account if exists
          if (project.account_user_id) {
            notificationsToCreate.push({
              user_id: project.account_user_id,
              project_id: project.id,
              type: "deadline_overdue",
              title: "Scadenza Superata",
              message: `Il progetto "${project.name}" ha superato la data di scadenza di ${Math.abs(daysUntilDeadline)} giorni.`,
            });
          }
        }
      }
      // Check if deadline is approaching (7 days, 3 days, 1 day)
      else if (daysUntilDeadline <= 7 && daysUntilDeadline > 0) {
        const { data: existingNotif } = await supabase
          .from("notifications")
          .select("id")
          .eq("project_id", project.id)
          .eq("type", "deadline_approaching")
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();

        if (!existingNotif && [7, 3, 1].includes(daysUntilDeadline)) {
          // Notify project leader
          notificationsToCreate.push({
            user_id: project.user_id,
            project_id: project.id,
            type: "deadline_approaching",
            title: "Scadenza in Avvicinamento",
            message: `Il progetto "${project.name}" scade tra ${daysUntilDeadline} ${daysUntilDeadline === 1 ? 'giorno' : 'giorni'}.`,
          });

          // Notify account if exists
          if (project.account_user_id) {
            notificationsToCreate.push({
              user_id: project.account_user_id,
              project_id: project.id,
              type: "deadline_approaching",
              title: "Scadenza in Avvicinamento",
              message: `Il progetto "${project.name}" scade tra ${daysUntilDeadline} ${daysUntilDeadline === 1 ? 'giorno' : 'giorni'}.`,
            });
          }
        }
      }
    }

    // Create all notifications
    if (notificationsToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from("notifications")
        .insert(notificationsToCreate);

      if (insertError) {
        console.error("Error creating notifications:", insertError);
        throw insertError;
      }

      console.log(`Created ${notificationsToCreate.length} notifications`);
    } else {
      console.log("No notifications needed");
    }

    return new Response(
      JSON.stringify({
        success: true,
        projectsChecked: projects?.length || 0,
        notificationsCreated: notificationsToCreate.length,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in check-project-deadlines:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
