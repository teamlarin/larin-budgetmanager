import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProjectAlert {
  type: string;
  title: string;
  message: string;
  level: 'warning' | 'critical';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
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

    console.log("Starting project alerts check...");

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch global projection thresholds
    const { data: thresholdsData } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "projection_thresholds")
      .maybeSingle();
    
    const globalThresholds = thresholdsData?.setting_value as { warning: number; critical: number } | null;
    const defaultWarningThreshold = globalThresholds?.warning ?? 10;
    const defaultCriticalThreshold = globalThresholds?.critical ?? 25;

    // Fetch overheads setting
    const { data: overheadsData } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "overheads")
      .maybeSingle();
    
    const overheadsAmount = overheadsData?.setting_value && 
      typeof overheadsData.setting_value === "object" && 
      "amount" in overheadsData.setting_value 
      ? Number((overheadsData.setting_value as { amount: number }).amount) || 0 
      : 0;

    console.log("Overheads amount:", overheadsAmount);

    // Fetch all approved projects with dates
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select(`
        id, name, total_budget, margin_percentage, user_id, account_user_id, 
        project_leader_id, area, start_date, end_date, 
        projection_warning_threshold, projection_critical_threshold
      `)
      .eq("status", "approvato");

    if (projectsError) {
      console.error("Error fetching projects:", projectsError);
      throw projectsError;
    }

    if (!projects || projects.length === 0) {
      console.log("No approved projects found");
      return new Response(JSON.stringify({ message: "No projects to check" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    console.log(`Found ${projects.length} approved projects to check`);

    const projectIds = projects.map(p => p.id);

    // Fetch budget items for all projects
    const { data: budgetItemsData } = await supabase
      .from("budget_items")
      .select("id, project_id, is_product, total_cost, hours_worked")
      .in("project_id", projectIds);
    
    const budgetItemsMap = new Map(budgetItemsData?.map(bi => [bi.id, bi.project_id]) || []);
    const budgetItemIds = budgetItemsData?.map(bi => bi.id) || [];

    // Calculate external costs (products) and activities budget per project
    const externalCostsMap = new Map<string, number>();
    const activitiesBudgetMap = new Map<string, number>();
    const plannedHoursMap = new Map<string, number>();
    
    budgetItemsData?.forEach((item: any) => {
      if (item.is_product) {
        const currentCost = externalCostsMap.get(item.project_id) || 0;
        externalCostsMap.set(item.project_id, currentCost + Number(item.total_cost || 0));
      } else {
        const currentBudget = activitiesBudgetMap.get(item.project_id) || 0;
        activitiesBudgetMap.set(item.project_id, currentBudget + Number(item.total_cost || 0));
        const currentHours = plannedHoursMap.get(item.project_id) || 0;
        plannedHoursMap.set(item.project_id, currentHours + Number(item.hours_worked || 0));
      }
    });

    // Fetch additional costs
    const { data: additionalCostsData } = await supabase
      .from("project_additional_costs")
      .select("project_id, amount")
      .in("project_id", projectIds);

    // Add additional costs to external costs map
    additionalCostsData?.forEach((cost: any) => {
      const currentCost = externalCostsMap.get(cost.project_id) || 0;
      externalCostsMap.set(cost.project_id, currentCost + Number(cost.amount || 0));
    });

    // Fetch time tracking entries (paginated)
    let allTimeTracking: any[] = [];
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: timeTrackingBatch } = await supabase
        .from("activity_time_tracking")
        .select("budget_item_id, actual_start_time, actual_end_time, user_id")
        .in("budget_item_id", budgetItemIds)
        .not("actual_start_time", "is", null)
        .not("actual_end_time", "is", null)
        .range(offset, offset + batchSize - 1);

      if (timeTrackingBatch && timeTrackingBatch.length > 0) {
        allTimeTracking = [...allTimeTracking, ...timeTrackingBatch];
        offset += batchSize;
        hasMore = timeTrackingBatch.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    console.log(`Found ${allTimeTracking.length} time tracking entries`);

    // Fetch user hourly rates from profiles (fallback)
    const timeTrackingUserIds = [...new Set(allTimeTracking.map(t => t.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, hourly_rate")
      .in("id", timeTrackingUserIds);
    
    const profileRatesMap = new Map(profiles?.map(p => [p.id, Number(p.hourly_rate) || 0]) || []);

    // Fetch user contract periods for historical hourly rates
    const { data: contractPeriods } = await supabase
      .from("user_contract_periods")
      .select("user_id, start_date, end_date, hourly_rate")
      .in("user_id", timeTrackingUserIds)
      .order("start_date", { ascending: false });

    // Function to get hourly rate at a specific date
    const getHourlyRateAtDate = (userId: string, date: Date): number => {
      const dateStr = date.toISOString().split('T')[0];
      
      const matchingPeriod = contractPeriods?.find(cp => {
        if (cp.user_id !== userId) return false;
        if (cp.start_date > dateStr) return false;
        if (cp.end_date && cp.end_date < dateStr) return false;
        return true;
      });

      if (matchingPeriod) {
        return matchingPeriod.hourly_rate || 0;
      }

      return profileRatesMap.get(userId) || 0;
    };

    // Calculate confirmed costs and hours per project
    const confirmedCostsMap = new Map<string, number>();
    const confirmedHoursMap = new Map<string, number>();
    
    allTimeTracking.forEach(entry => {
      const projectId = budgetItemsMap.get(entry.budget_item_id);
      if (projectId && entry.actual_start_time && entry.actual_end_time) {
        const start = new Date(entry.actual_start_time);
        const end = new Date(entry.actual_end_time);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        const userHourlyRate = getHourlyRateAtDate(entry.user_id, start);
        const cost = hours * (userHourlyRate + overheadsAmount);
        
        const currentCost = confirmedCostsMap.get(projectId) || 0;
        confirmedCostsMap.set(projectId, currentCost + cost);
        
        const currentHours = confirmedHoursMap.get(projectId) || 0;
        confirmedHoursMap.set(projectId, currentHours + hours);
      }
    });

    // Fetch admins
    const { data: adminUsers } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    
    const adminIds = adminUsers?.map(u => u.user_id) || [];

    // Fetch team leaders with their areas
    const { data: teamLeaderAreas } = await supabase
      .from("team_leader_areas")
      .select("user_id, area");
    
    const teamLeadersByArea = new Map<string, string[]>();
    teamLeaderAreas?.forEach(tla => {
      const areaLower = tla.area.toLowerCase();
      const existing = teamLeadersByArea.get(areaLower) || [];
      if (!existing.includes(tla.user_id)) {
        existing.push(tla.user_id);
        teamLeadersByArea.set(areaLower, existing);
      }
    });

    // Get existing notifications from last 24 hours to avoid duplicates
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: recentNotifications } = await supabase
      .from("notifications")
      .select("project_id, type, created_at")
      .in("type", [
        "margin_warning", "margin_critical",
        "budget_warning_50", "budget_warning_75", "budget_warning_90", "budget_exceeded",
        "deadline_approaching", "project_overdue",
        "projection_warning", "projection_critical"
      ])
      .gte("created_at", yesterday.toISOString());

    const recentNotificationsMap = new Map(
      recentNotifications?.map(n => [`${n.project_id}-${n.type}`, true]) || []
    );

    let alertsCreated = 0;
    const today = new Date();

    const formatCurrency = (value: number) => `€${value.toLocaleString('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

    // Check each project
    for (const project of projects) {
      const alerts: ProjectAlert[] = [];
      
      const marginPercentage = project.margin_percentage || 0;
      const activitiesBudget = activitiesBudgetMap.get(project.id) || 0;
      const confirmedCosts = confirmedCostsMap.get(project.id) || 0;
      const externalCosts = externalCostsMap.get(project.id) || 0;
      const totalSpent = confirmedCosts + externalCosts;
      const plannedHours = plannedHoursMap.get(project.id) || 0;
      const confirmedHours = confirmedHoursMap.get(project.id) || 0;
      
      // Budget consumption relative to target budget
      const targetConsumptionPercentage = targetBudget > 0 ? (totalSpent / targetBudget) * 100 : 0;
      
      // 1. Budget Exceeded (Critical) - 100% of gross activities budget
      if (consumptionPercentage >= 100) {
        alerts.push({
          type: "budget_exceeded",
          title: "🔴 Budget Superato",
          message: `Il budget del progetto "${project.name}" ha superato il 100%. Consumo attuale: ${consumptionPercentage.toFixed(1)}%`,
          level: 'critical'
        });
      }

      // Progressive budget warnings based on target budget
      if (targetBudget > 0) {
        // 2. 90% of target (Critical)
        if (targetConsumptionPercentage >= 90 && consumptionPercentage < 100) {
          alerts.push({
            type: "budget_warning_90",
            title: "🔴 Budget al 90% del Target",
            message: `Il consumo del progetto "${project.name}" ha raggiunto il ${targetConsumptionPercentage.toFixed(1)}% del budget target (${formatCurrency(totalSpent)} / ${formatCurrency(targetBudget)})`,
            level: 'critical'
          });
        }
        // 3. 75% of target (Warning)
        else if (targetConsumptionPercentage >= 75) {
          alerts.push({
            type: "budget_warning_75",
            title: "🟡 Budget al 75% del Target",
            message: `Il consumo del progetto "${project.name}" ha raggiunto il ${targetConsumptionPercentage.toFixed(1)}% del budget target (${formatCurrency(totalSpent)} / ${formatCurrency(targetBudget)})`,
            level: 'warning'
          });
        }
        // 4. 50% of target (Warning)
        else if (targetConsumptionPercentage >= 50) {
          alerts.push({
            type: "budget_warning_50",
            title: "🟡 Budget al 50% del Target",
            message: `Il consumo del progetto "${project.name}" ha raggiunto il ${targetConsumptionPercentage.toFixed(1)}% del budget target (${formatCurrency(totalSpent)} / ${formatCurrency(targetBudget)})`,
            level: 'warning'
          });
        }
      }

      // Date-based alerts
      if (project.start_date && project.end_date) {
        const startDate = new Date(project.start_date);
        const endDate = new Date(project.end_date);
        const totalDays = Math.max(1, (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysElapsed = Math.max(0, (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        const isOverdue = today > endDate;
        
        // 3. Project Overdue (Critical)
        if (isOverdue) {
          alerts.push({
            type: "project_overdue",
            title: "🔴 Progetto Scaduto",
            message: `La data di fine del progetto "${project.name}" è stata superata di ${Math.abs(daysRemaining)} giorni.`,
            level: 'critical'
          });
        } 
        // 4. Deadline Approaching (Warning) - 7 days
        else if (daysRemaining > 0 && daysRemaining <= 7) {
          alerts.push({
            type: "deadline_approaching",
            title: "🟡 Scadenza Imminente",
            message: `Mancano solo ${daysRemaining} giorni alla scadenza del progetto "${project.name}".`,
            level: 'warning'
          });
        }

        // Projection calculations
        if (totalSpent > 0 && targetBudget > 0) {
          const dailyRate = totalSpent / Math.max(1, daysElapsed);
          const projectedFinalCost = dailyRate * totalDays;
          const projectionExcessPercentage = ((projectedFinalCost - targetBudget) / targetBudget) * 100;
          
          const projectionWarningThreshold = project.projection_warning_threshold ?? defaultWarningThreshold;
          const projectionCriticalThreshold = project.projection_critical_threshold ?? defaultCriticalThreshold;
          
          // 5. Projection Critical
          if (projectionExcessPercentage >= projectionCriticalThreshold) {
            alerts.push({
              type: "projection_critical",
              title: "🔴 Proiezione Budget Critica",
              message: `La proiezione a fine progetto "${project.name}" (${formatCurrency(projectedFinalCost)}) supera il target di ${projectionExcessPercentage.toFixed(0)}%. Eccesso: ${formatCurrency(projectedFinalCost - targetBudget)}`,
              level: 'critical'
            });
          } 
          // 6. Projection Warning
          else if (projectionExcessPercentage >= projectionWarningThreshold) {
            alerts.push({
              type: "projection_warning",
              title: "🟡 Proiezione Budget Elevata",
              message: `La proiezione a fine progetto "${project.name}" (${formatCurrency(projectedFinalCost)}) supera il target di ${projectionExcessPercentage.toFixed(0)}%. Eccesso stimato: ${formatCurrency(projectedFinalCost - targetBudget)}`,
              level: 'warning'
            });
          }
        }
      }

      // Build recipients list: project leader, team leaders (by area), admins
      const recipients = new Set<string>();
      
      // Add project leader
      if (project.project_leader_id) {
        recipients.add(project.project_leader_id);
      }
      
      // Add team leaders for project's area
      if (project.area) {
        const areaLower = project.area.toLowerCase();
        const teamLeaders = teamLeadersByArea.get(areaLower) || [];
        teamLeaders.forEach(id => recipients.add(id));
      }
      
      // Add all admins
      adminIds.forEach(id => recipients.add(id));

      // Fetch notification preferences for recipients and alert types
      const alertTypes = alerts.map(a => a.type);
      const recipientIds = Array.from(recipients);
      
      const { data: notificationPrefs } = await supabase
        .from("notification_preferences")
        .select("user_id, notification_type, in_app_enabled")
        .in("user_id", recipientIds)
        .in("notification_type", alertTypes);
      
      // Create a map for quick lookup: userId-type -> in_app_enabled
      const prefsMap = new Map(
        notificationPrefs?.map(p => [`${p.user_id}-${p.notification_type}`, p.in_app_enabled]) || []
      );

      // Send notifications for each alert
      for (const alert of alerts) {
        const notificationKey = `${project.id}-${alert.type}`;
        
        if (!recentNotificationsMap.has(notificationKey)) {
          console.log(`${alert.level.toUpperCase()}: Project "${project.name}" - ${alert.type}`);
          
          for (const userId of recipients) {
            // Check user preference (default to true if not set)
            const prefKey = `${userId}-${alert.type}`;
            const inAppEnabled = prefsMap.get(prefKey) ?? true;
            
            if (inAppEnabled) {
              await supabase.from("notifications").insert({
                user_id: userId,
                type: alert.type,
                title: alert.title,
                message: alert.message,
                project_id: project.id,
                read: false,
              });
            }
          }
          alertsCreated++;
          recentNotificationsMap.set(notificationKey, true);
        }
      }
    }

    console.log(`Alert check complete. Total alerts created: ${alertsCreated}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        projectsChecked: projects.length,
        alertsCreated
      }), 
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error in check-margin-alerts function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
