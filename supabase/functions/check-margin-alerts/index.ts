import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProjectMarginData {
  id: string;
  name: string;
  total_budget: number;
  margin_percentage: number;
  projection_warning_threshold: number;
  projection_critical_threshold: number;
  user_id: string;
  account_user_id: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      .select("id, name, total_budget, margin_percentage, projection_warning_threshold, projection_critical_threshold, user_id, account_user_id")
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
      .select("id, project_id")
      .in("project_id", projectIds);
    
    const budgetItemsMap = new Map(budgetItemsData?.map(bi => [bi.id, bi.project_id]) || []);
    const budgetItemIds = budgetItemsData?.map(bi => bi.id) || [];

    // Fetch time tracking entries for confirmed hours
    const { data: timeTrackingData } = await supabase
      .from("activity_time_tracking")
      .select("budget_item_id, actual_start_time, actual_end_time, user_id")
      .in("budget_item_id", budgetItemIds)
      .not("actual_start_time", "is", null)
      .not("actual_end_time", "is", null);

    // Fetch user hourly rates from profiles
    const timeTrackingUserIds = [...new Set(timeTrackingData?.map(t => t.user_id) || [])];
    const { data: timeTrackingProfiles } = await supabase
      .from("profiles")
      .select("id, hourly_rate")
      .in("id", timeTrackingUserIds);
    
    const profileHourlyRateMap = new Map(timeTrackingProfiles?.map(p => [p.id, Number(p.hourly_rate) || 0]) || []);

    // Calculate confirmed costs per project
    const confirmedCostsMap = new Map<string, number>();
    timeTrackingData?.forEach(entry => {
      const projectId = budgetItemsMap.get(entry.budget_item_id);
      if (projectId && entry.actual_start_time && entry.actual_end_time) {
        const start = new Date(entry.actual_start_time);
        const end = new Date(entry.actual_end_time);
        const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
        const userHourlyRate = profileHourlyRateMap.get(entry.user_id) || 0;
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

    // Check each project's margin
    for (const project of projects) {
      const confirmedCosts = confirmedCostsMap.get(project.id) || 0;
      const marginPercentage = project.margin_percentage || 0;
      const totalBudget = project.total_budget || 0;
      const warningThreshold = project.projection_warning_threshold || 10;
      const criticalThreshold = project.projection_critical_threshold || 25;
      
      // Target budget = budget disponibile dopo aver tolto il margine
      const targetBudget = totalBudget * (1 - marginPercentage / 100);
      
      // Marginalità residua = quanto margine rimane rispetto al budget totale
      const remainingBudget = targetBudget - confirmedCosts;
      const residualMargin = totalBudget > 0 ? (remainingBudget / totalBudget) * 100 : 0;
      
      // Calculate difference from target margin
      const marginDifference = marginPercentage - residualMargin;
      
      // Determine alert level
      const isCritical = marginDifference >= criticalThreshold || residualMargin < 0;
      const isWarning = marginDifference >= warningThreshold && !isCritical;
      
      // Get recipients (project leader and account)
      const recipients: string[] = [];
      if (project.user_id) recipients.push(project.user_id);
      if (project.account_user_id && project.account_user_id !== project.user_id) {
        recipients.push(project.account_user_id);
      }

      if (isCritical) {
        // Check if we already sent a critical notification for this project recently
        const notificationKey = `${project.id}-margin_critical`;
        if (!recentNotificationsMap.has(notificationKey)) {
          console.log(`CRITICAL margin alert for project ${project.name}: ${residualMargin.toFixed(1)}%`);
          
          for (const userId of recipients) {
            await supabase.from("notifications").insert({
              user_id: userId,
              type: "margin_critical",
              title: "⚠️ Marginalità critica",
              message: `Il progetto "${project.name}" ha una marginalità residua critica: ${residualMargin.toFixed(1)}% (obiettivo: ${marginPercentage}%). Costi confermati: €${confirmedCosts.toFixed(2)}`,
              project_id: project.id,
              read: false,
            });
          }
          criticalCount++;
        }
      } else if (isWarning) {
        // Check if we already sent a warning notification for this project recently
        const notificationKey = `${project.id}-margin_warning`;
        if (!recentNotificationsMap.has(notificationKey)) {
          console.log(`WARNING margin alert for project ${project.name}: ${residualMargin.toFixed(1)}%`);
          
          for (const userId of recipients) {
            await supabase.from("notifications").insert({
              user_id: userId,
              type: "margin_warning",
              title: "⚡ Attenzione marginalità",
              message: `Il progetto "${project.name}" ha una marginalità residua in calo: ${residualMargin.toFixed(1)}% (obiettivo: ${marginPercentage}%). Costi confermati: €${confirmedCosts.toFixed(2)}`,
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
