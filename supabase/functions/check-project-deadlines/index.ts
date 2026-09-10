import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.74.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Project {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string;
  user_id: string;
  account_user_id: string | null;
  project_status: string;
  billing_type: string | null;
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
      .select("id, name, start_date, end_date, user_id, account_user_id, project_status, billing_type")
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

      console.log(`Project ${project.name}: ${daysUntilDeadline} days until deadline, billing_type: ${project.billing_type}`);

      // Check for recurring projects at 90% temporal completion
      if (project.billing_type === 'recurring' && project.start_date) {
        const startDate = new Date(project.start_date);
        const totalDays = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
        const daysElapsed = Math.ceil((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const temporalProgress = Math.min(100, Math.max(0, (daysElapsed / totalDays) * 100));

        console.log(`Recurring project ${project.name}: ${temporalProgress.toFixed(1)}% temporal progress`);

        // Notify at 90% completion
        if (temporalProgress >= 90 && temporalProgress < 100) {
          const { data: existingNotif } = await supabase
            .from("notifications")
            .select("id")
            .eq("project_id", project.id)
            .eq("type", "recurring_90_percent")
            .maybeSingle();

          if (!existingNotif) {
            console.log(`Creating 90% notification for recurring project ${project.name}`);
            
            // Notify project leader
            notificationsToCreate.push({
              user_id: project.user_id,
              project_id: project.id,
              type: "recurring_90_percent",
              title: "Progetto Recurring al 90%",
              message: `Il progetto recurring "${project.name}" ha raggiunto il ${Math.round(temporalProgress)}% di completamento temporale.`,
            });

            // Notify account if exists
            if (project.account_user_id) {
              notificationsToCreate.push({
                user_id: project.account_user_id,
                project_id: project.id,
                type: "recurring_90_percent",
                title: "Progetto Recurring al 90%",
                message: `Il progetto recurring "${project.name}" ha raggiunto il ${Math.round(temporalProgress)}% di completamento temporale.`,
              });
            }
          }
        }
      }

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
      // 14-day / 30-day horizon: single once-per-project notification per threshold
      else if (daysUntilDeadline === 14 || daysUntilDeadline === 30) {
        const notifType = daysUntilDeadline === 14 ? "deadline_14_days" : "deadline_30_days";
        const title = daysUntilDeadline === 14 ? "Scadenza tra 14 giorni" : "Scadenza tra 30 giorni";
        const { data: existingNotif } = await supabase
          .from("notifications")
          .select("id")
          .eq("project_id", project.id)
          .eq("type", notifType)
          .maybeSingle();

        if (!existingNotif) {
          notificationsToCreate.push({
            user_id: project.user_id,
            project_id: project.id,
            type: notifType,
            title,
            message: `Il progetto "${project.name}" scade tra ${daysUntilDeadline} giorni. Verifica avanzamento e marginalità.`,
          });
          if (project.account_user_id) {
            notificationsToCreate.push({
              user_id: project.account_user_id,
              project_id: project.id,
              type: notifType,
              title,
              message: `Il progetto "${project.name}" scade tra ${daysUntilDeadline} giorni. Verifica avanzamento e marginalità.`,
            });
          }
        }
      }
    }

    // ---- Promemoria scadenze task ----
    const todayIso = new Date().toISOString().slice(0, 10);
    const tomorrowIso = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const { data: tasks, error: tasksError } = await supabase
      .from("project_tasks")
      .select("id, title, due_date, status, project_id, projects(name), project_task_assignees(user_id)")
      .neq("status", "done")
      .not("due_date", "is", null)
      .lte("due_date", tomorrowIso);

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError);
    } else {
      const since = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
      for (const task of (tasks ?? []) as Array<Record<string, unknown>>) {
        const dueDate = String(task.due_date);
        const isOverdue = dueDate < todayIso;
        const isDueTomorrow = dueDate === tomorrowIso;
        if (!isOverdue && !isDueTomorrow) continue;

        const type = isOverdue ? "task_overdue" : "task_due_soon";
        const projectRel = task.projects as { name?: string } | Array<{ name?: string }> | null;
        const projectName = Array.isArray(projectRel) ? projectRel[0]?.name : projectRel?.name;
        const projectSuffix = projectName ? ` del progetto "${projectName}"` : "";
        const title = isOverdue ? "Task scaduta" : "Task in scadenza domani";
        const message = isOverdue
          ? `La task "${task.title}"${projectSuffix} è scaduta il ${dueDate} e non è ancora completata.`
          : `La task "${task.title}"${projectSuffix} scade domani.`;

        const assignees = ((task.project_task_assignees ?? []) as Array<{ user_id: string }>)
          .map((a) => a.user_id)
          .filter(Boolean);

        for (const userId of Array.from(new Set(assignees))) {
          // Dedup: niente doppio promemoria dello stesso tipo nelle ultime 20 ore
          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", userId)
            .eq("type", type)
            .gte("created_at", since)
            .ilike("message", `%"${task.title}"%`)
            .maybeSingle();
          if (existing) continue;

          // Rispetta le preferenze in-app dell'utente
          const { data: pref } = await supabase
            .from("notification_preferences")
            .select("in_app_enabled")
            .eq("user_id", userId)
            .eq("notification_type", type)
            .maybeSingle();
          if (pref && pref.in_app_enabled === false) continue;

          notificationsToCreate.push({
            user_id: userId,
            project_id: task.project_id as string | null,
            type,
            title,
            message,
          });
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
