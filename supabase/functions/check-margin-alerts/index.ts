import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    console.log("Starting margin alerts check...");

    // Initialize Supabase client with service role key
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

    // Fetch all approved projects
    const { data: projects, error: projectsError } = await supabase
      .from("projects")
      .select("id, name, total_budget, margin_percentage, user_id, account_user_id")
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
      .select("id, project_id, is_product, total_cost")
      .in("project_id", projectIds);
    
    const budgetItemsMap = new Map(budgetItemsData?.map(bi => [bi.id, bi.project_id]) || []);
    const budgetItemIds = budgetItemsData?.map(bi => bi.id) || [];

    // Calculate external costs (products) per project - gross cost (aligned with calculate-project-margins)
    const externalCostsMap = new Map<string, number>();
    budgetItemsData?.forEach((item: any) => {
      if (item.is_product) {
        const currentCost = externalCostsMap.get(item.project_id) || 0;
        externalCostsMap.set(item.project_id, currentCost + Number(item.total_cost || 0));
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

    // Fetch time tracking entries for confirmed hours (paginated to handle large datasets)
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

    console.log(`Found ${contractPeriods?.length || 0} contract periods`);

    // Function to get hourly rate at a specific date (replicates get_user_hourly_rate_at_date)
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

    // Calculate confirmed costs per project (aligned with calculate-project-margins)
    const confirmedCostsMap = new Map<string, number>();
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
      }
    });

    // Get existing margin notifications from last 24 hours to avoid duplicates
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const { data: recentNotifications } = await supabase
      .from("notifications")
      .select("project_id, type, created_at")
      .in("type", ["margin_warning", "margin_critical"])
      .gte("created_at", yesterday.toISOString());

    const recentNotificationsMap = new Map(
      recentNotifications?.map(n => [`${n.project_id}-${n.type}`, true]) || []
    );

    let warningCount = 0;
    let criticalCount = 0;

    // Warning threshold: 5% above target margin
    const WARNING_THRESHOLD = 5;

    // Check each project's margin
    for (const project of projects) {
      const marginPercentage = project.margin_percentage || 0;
      const totalBudget = project.total_budget || 0;
      
      // Skip projects without margin target or budget
      if (marginPercentage === 0 || totalBudget === 0) {
        continue;
      }
      
      const confirmedCosts = confirmedCostsMap.get(project.id) || 0;
      const externalCosts = externalCostsMap.get(project.id) || 0;
      const totalSpent = confirmedCosts + externalCosts;
      
      // Margine residuo % = (Budget Totale - Costi Sostenuti) / Budget Totale × 100
      // Aligned with calculate-project-margins and ProjectBudgetStats
      const remainingPercentage = ((totalBudget - totalSpent) / totalBudget) * 100;
      
      // Determine alert level based on target margin
      // Critical: remaining percentage <= target margin
      // Warning: remaining percentage <= target margin + 5%
      const isCritical = remainingPercentage <= marginPercentage;
      const isWarning = remainingPercentage <= marginPercentage + WARNING_THRESHOLD && !isCritical;
      
      // Get recipients: only admins and team_leaders
      const recipients: string[] = [];

      // Fetch admins and team_leaders
      const { data: adminAndLeaderUsers } = await supabase
        .from("user_roles")
        .select("user_id")
        .in("role", ["admin", "team_leader"]);
      
      adminAndLeaderUsers?.forEach(user => {
        if (!recipients.includes(user.user_id)) {
          recipients.push(user.user_id);
        }
      });

      if (isCritical) {
        const notificationKey = `${project.id}-margin_critical`;
        if (!recentNotificationsMap.has(notificationKey)) {
          console.log(`CRITICAL: Project "${project.name}" - Remaining: ${remainingPercentage.toFixed(1)}%, Target: ${marginPercentage}%`);
          
          for (const userId of recipients) {
            await supabase.from("notifications").insert({
              user_id: userId,
              type: "margin_critical",
              title: "🔴 Margine obiettivo raggiunto",
              message: `Il progetto "${project.name}" ha raggiunto il margine obiettivo. Margine residuo: ${remainingPercentage.toFixed(1)}% (obiettivo: ${marginPercentage}%). Costi sostenuti: €${totalSpent.toFixed(2)}`,
              project_id: project.id,
              read: false,
            });
          }
          criticalCount++;
        }
      } else if (isWarning) {
        const notificationKey = `${project.id}-margin_warning`;
        if (!recentNotificationsMap.has(notificationKey)) {
          console.log(`WARNING: Project "${project.name}" - Remaining: ${remainingPercentage.toFixed(1)}%, Target: ${marginPercentage}%`);
          
          for (const userId of recipients) {
            await supabase.from("notifications").insert({
              user_id: userId,
              type: "margin_warning",
              title: "🟡 Vicino al margine obiettivo",
              message: `Il progetto "${project.name}" si sta avvicinando al margine obiettivo. Margine residuo: ${remainingPercentage.toFixed(1)}% (obiettivo: ${marginPercentage}%). Costi sostenuti: €${totalSpent.toFixed(2)}`,
              project_id: project.id,
              read: false,
            });
          }
          warningCount++;
        }
      }
    }

    console.log(`Margin check complete. Warnings: ${warningCount}, Critical: ${criticalCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        projectsChecked: projects.length,
        warningsCreated: warningCount,
        criticalAlertsCreated: criticalCount
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
