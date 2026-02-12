import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const startTime = Date.now();

    // Create Supabase client with service role key to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get optional project_ids filter from request body
    let projectIds: string[] | null = null;
    try {
      const body = await req.json();
      projectIds = body.project_ids || null;
    } catch {
      // No body or invalid JSON, will fetch all approved projects
    }

    // Fetch approved projects
    let projectsQuery = supabaseAdmin
      .from('projects')
      .select('id, name, total_budget, margin_percentage, project_type, total_hours, billing_type, manual_activities_budget')
      .eq('status', 'approvato');

    if (projectIds && projectIds.length > 0) {
      projectsQuery = projectsQuery.in('id', projectIds);
    }

    const { data: projects, error: projectsError } = await projectsQuery;

    if (projectsError) {
      throw projectsError;
    }

    if (!projects || projects.length === 0) {
      return new Response(JSON.stringify({ margins: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const projectIdsList = projects.map(p => p.id);

    // PARALLEL FETCH: budget items, additional costs, app settings
    const [budgetItemsResult, additionalCostsResult, overheadSettingResult] = await Promise.all([
      supabaseAdmin
        .from('budget_items')
        .select('id, project_id, is_product, total_cost, vat_rate, hours_worked')
        .in('project_id', projectIdsList),
      supabaseAdmin
        .from('project_additional_costs')
        .select('project_id, amount')
        .in('project_id', projectIdsList),
      supabaseAdmin
        .from('app_settings')
        .select('setting_value')
        .eq('setting_key', 'overheads')
        .maybeSingle()
    ]);

    if (budgetItemsResult.error) throw budgetItemsResult.error;
    const budgetItems = budgetItemsResult.data || [];
    const additionalCosts = additionalCostsResult.data || [];
    const overheadsAmount = (overheadSettingResult.data?.setting_value as { amount?: number })?.amount || 0;

    // Calculate total planned hours and activities budget per project from budget_items (non-product items)
    const plannedHoursPerProject = new Map<string, number>();
    const activitiesBudgetPerProject = new Map<string, number>();
    const budgetItemToProject = new Map<string, string>();
    
    budgetItems.forEach(bi => {
      budgetItemToProject.set(bi.id, bi.project_id);
      if (!bi.is_product) {
        plannedHoursPerProject.set(
          bi.project_id, 
          (plannedHoursPerProject.get(bi.project_id) || 0) + (bi.hours_worked || 0)
        );
        activitiesBudgetPerProject.set(
          bi.project_id,
          (activitiesBudgetPerProject.get(bi.project_id) || 0) + (bi.total_cost || 0)
        );
      }
    });

    const budgetItemIds = budgetItems.map(bi => bi.id);

    // Fetch ALL time tracking entries, batching budget_item_ids to avoid URL length limits
    // and paginating each batch to avoid the 1000 row default limit
    const batchSize = 100; // max IDs per query to keep URL short
    const pageSize = 1000;
    let allTimeTracking: any[] = [];

    for (let i = 0; i < budgetItemIds.length; i += batchSize) {
      const idsBatch = budgetItemIds.slice(i, i + batchSize);
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: batch, error } = await supabaseAdmin
          .from('activity_time_tracking')
          .select('budget_item_id, actual_start_time, actual_end_time, user_id')
          .in('budget_item_id', idsBatch)
          .not('actual_start_time', 'is', null)
          .not('actual_end_time', 'is', null)
          .range(offset, offset + pageSize - 1);
        
        if (error) throw error;
        
        if (batch && batch.length > 0) {
          allTimeTracking = [...allTimeTracking, ...batch];
          offset += pageSize;
          hasMore = batch.length === pageSize;
        } else {
          hasMore = false;
        }
      }
    }

    const timeTracking = allTimeTracking;
    console.log(`Total time tracking entries fetched: ${timeTracking.length}`);

    // Get unique user IDs and fetch profiles + contract periods in parallel
    const userIds = [...new Set(timeTracking.map(tt => tt.user_id))];
    
    const [profilesResult, contractPeriodsResult] = userIds.length > 0 
      ? await Promise.all([
          supabaseAdmin.from('profiles').select('id, hourly_rate').in('id', userIds),
          supabaseAdmin.from('user_contract_periods')
            .select('user_id, start_date, end_date, hourly_rate')
            .in('user_id', userIds)
            .order('start_date', { ascending: false })
        ])
      : [{ data: [] }, { data: [] }];

    // Create fallback rates map from profiles
    const profileRatesMap = new Map<string, number>();
    (profilesResult.data || []).forEach(p => profileRatesMap.set(p.id, p.hourly_rate || 0));
    
    const contractPeriods = contractPeriodsResult.data || [];

    // Function to get hourly rate at a specific date
    const getHourlyRateAtDate = (userId: string, date: Date): number => {
      const dateStr = date.toISOString().split('T')[0];
      
      const matchingPeriod = contractPeriods.find(cp => {
        if (cp.user_id !== userId) return false;
        if (cp.start_date > dateStr) return false;
        if (cp.end_date && cp.end_date < dateStr) return false;
        return true;
      });

      return matchingPeriod?.hourly_rate || profileRatesMap.get(userId) || 0;
    };

    // Calculate labor costs and confirmed hours per project
    const laborCostsPerProject = new Map<string, number>();
    const confirmedHoursPerProject = new Map<string, number>();
    
    timeTracking.forEach(tt => {
      const projectId = budgetItemToProject.get(tt.budget_item_id);
      if (!projectId) return;

      const startTime = new Date(tt.actual_start_time);
      const endTime = new Date(tt.actual_end_time);
      const hoursWorked = Math.abs(endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      const hourlyRate = getHourlyRateAtDate(tt.user_id, startTime);
      const laborCost = hoursWorked * (hourlyRate + overheadsAmount);

      laborCostsPerProject.set(projectId, (laborCostsPerProject.get(projectId) || 0) + laborCost);
      confirmedHoursPerProject.set(projectId, (confirmedHoursPerProject.get(projectId) || 0) + hoursWorked);
    });

    // Calculate external costs per project
    const externalCostsPerProject = new Map<string, number>();
    budgetItems.forEach(bi => {
      if (bi.is_product) {
        externalCostsPerProject.set(
          bi.project_id, 
          (externalCostsPerProject.get(bi.project_id) || 0) + (bi.total_cost || 0)
        );
      }
    });

    // Add additional costs to external costs
    additionalCosts.forEach(ac => {
      externalCostsPerProject.set(
        ac.project_id, 
        (externalCostsPerProject.get(ac.project_id) || 0) + (ac.amount || 0)
      );
    });

    // Calculate margins
    const margins: Record<string, { 
      residualMargin: number; 
      laborCost: number; 
      externalCost: number; 
      totalCost: number;
      budget: number;
      targetBudget: number;
      confirmedHours: number;
      totalHours: number;
      projectType: string;
    }> = {};

    const packProjectsToUpdate: { id: string; progress: number }[] = [];

    projects.forEach(project => {
      const laborCost = laborCostsPerProject.get(project.id) || 0;
      const externalCost = externalCostsPerProject.get(project.id) || 0;
      const confirmedHours = confirmedHoursPerProject.get(project.id) || 0;
      const totalCost = laborCost + externalCost;
      const budget = project.total_budget || 0;
      const totalHours = plannedHoursPerProject.get(project.id) || project.total_hours || 0;
      const marginPercentage = project.margin_percentage || 0;

      // Use manual_activities_budget if set, otherwise sum of non-product budget items
      const activitiesBudget = project.manual_activities_budget != null
        ? project.manual_activities_budget
        : (activitiesBudgetPerProject.get(project.id) || 0);

      const targetBudget = activitiesBudget * (1 - marginPercentage / 100);

      // Margine Residuo aligned with ProjectBudgetStats:
      // (activitiesBudget - totalSpent) / activitiesBudget * 100
      let residualMargin: number;
      if (activitiesBudget > 0) {
        residualMargin = ((activitiesBudget - totalCost) / activitiesBudget) * 100;
      } else if (totalCost > 0) {
        residualMargin = -100;
      } else {
        residualMargin = 0;
      }

      // Debug log for specific projects to trace discrepancies
      if (project.name?.includes('Cortina') || residualMargin < 20) {
        console.log(`[MARGIN DEBUG] ${project.name}: activitiesBudget=${activitiesBudget}, manual=${project.manual_activities_budget}, calculated=${activitiesBudgetPerProject.get(project.id) || 0}, laborCost=${laborCost}, externalCost=${externalCost}, totalCost=${totalCost}, residualMargin=${residualMargin.toFixed(2)}%`);
      }

      const isPackProject = project.billing_type === 'pack';
      if (isPackProject && totalHours > 0) {
        const calculatedProgress = Math.round((confirmedHours / totalHours) * 100);
        packProjectsToUpdate.push({ id: project.id, progress: calculatedProgress });
      }

      margins[project.id] = {
        residualMargin: Math.round(residualMargin * 100) / 100,
        laborCost: Math.round(laborCost * 100) / 100,
        externalCost: Math.round(externalCost * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        budget,
        targetBudget: Math.round(targetBudget * 100) / 100,
        confirmedHours: Math.round(confirmedHours * 100) / 100,
        totalHours,
        projectType: project.project_type || '',
      };
    });

    // Batch update progress for pack projects (parallel)
    if (packProjectsToUpdate.length > 0) {
      await Promise.all(
        packProjectsToUpdate.map(({ id, progress }) =>
          supabaseAdmin.from('projects').update({ progress }).eq('id', id)
        )
      );
    }

    console.log(`calculate-project-margins completed in ${Date.now() - startTime}ms for ${projects.length} projects`);

    return new Response(JSON.stringify({ margins }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("Error in calculate-project-margins:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
