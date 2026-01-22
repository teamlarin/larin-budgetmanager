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
    console.log("Starting calculate-project-margins function");

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
      .select('id, name, total_budget, margin_percentage, project_type, total_hours, billing_type')
      .eq('status', 'approvato');

    if (projectIds && projectIds.length > 0) {
      projectsQuery = projectsQuery.in('id', projectIds);
    }

    const { data: projects, error: projectsError } = await projectsQuery;

    if (projectsError) {
      console.error("Error fetching projects:", projectsError);
      throw projectsError;
    }

    console.log(`Found ${projects?.length || 0} approved projects`);

    if (!projects || projects.length === 0) {
      return new Response(JSON.stringify({ margins: {} }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const projectIdsList = projects.map(p => p.id);

    // Fetch all budget items for these projects (including hours_worked for total hours calculation)
    const { data: budgetItems, error: budgetItemsError } = await supabaseAdmin
      .from('budget_items')
      .select('id, project_id, is_product, total_cost, vat_rate, hours_worked')
      .in('project_id', projectIdsList);

    if (budgetItemsError) {
      console.error("Error fetching budget items:", budgetItemsError);
      throw budgetItemsError;
    }

    console.log(`Found ${budgetItems?.length || 0} budget items`);

    // Calculate total planned hours per project from budget_items (non-product items)
    const plannedHoursPerProject = new Map<string, number>();
    budgetItems?.forEach(bi => {
      if (!bi.is_product) {
        const currentHours = plannedHoursPerProject.get(bi.project_id) || 0;
        plannedHoursPerProject.set(bi.project_id, currentHours + (bi.hours_worked || 0));
      }
    });

    const budgetItemIds = budgetItems?.map(bi => bi.id) || [];

    // Fetch ALL time tracking data using service role (bypasses RLS)
    // Split budget item IDs into smaller batches to avoid URL length limits
    let allTimeTracking: any[] = [];
    const idBatchSize = 100; // Limit IDs per query to avoid URL too long
    const rowBatchSize = 1000; // Limit rows per page

    for (let idStart = 0; idStart < budgetItemIds.length; idStart += idBatchSize) {
      const idBatch = budgetItemIds.slice(idStart, idStart + idBatchSize);
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        const { data: timeTrackingBatch, error: timeTrackingError } = await supabaseAdmin
          .from('activity_time_tracking')
          .select('budget_item_id, actual_start_time, actual_end_time, user_id')
          .in('budget_item_id', idBatch)
          .not('actual_start_time', 'is', null)
          .not('actual_end_time', 'is', null)
          .range(offset, offset + rowBatchSize - 1);

        if (timeTrackingError) {
          console.error("Error fetching time tracking:", timeTrackingError);
          throw timeTrackingError;
        }

        if (timeTrackingBatch && timeTrackingBatch.length > 0) {
          allTimeTracking = [...allTimeTracking, ...timeTrackingBatch];
          offset += rowBatchSize;
          hasMore = timeTrackingBatch.length === rowBatchSize;
        } else {
          hasMore = false;
        }
      }
    }

    const timeTracking = allTimeTracking;
    console.log(`Found ${timeTracking?.length || 0} time tracking entries (batched by ${idBatchSize} IDs)`);

    // Fetch user hourly rates from profiles (fallback)
    const userIds = [...new Set(timeTracking?.map(tt => tt.user_id) || [])];
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, hourly_rate')
      .in('id', userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    // Fetch user contract periods for historical hourly rates
    // This replicates the logic of get_user_hourly_rate_at_date function
    const { data: contractPeriods, error: contractPeriodsError } = await supabaseAdmin
      .from('user_contract_periods')
      .select('user_id, start_date, end_date, hourly_rate')
      .in('user_id', userIds)
      .order('start_date', { ascending: false });

    if (contractPeriodsError) {
      console.error("Error fetching contract periods:", contractPeriodsError);
      // Continue without contract periods, will use profiles fallback
    }

    console.log(`Found ${contractPeriods?.length || 0} contract periods for ${userIds.length} users`);

    // Fetch overheads from app settings (same as ProjectBudgetStats.tsx)
    const { data: overheadSetting } = await supabaseAdmin
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'overheads')
      .maybeSingle();

    // overheadsAmount is an absolute value added to hourly rate, not a percentage
    const overheadsAmount = (overheadSetting?.setting_value as { amount?: number })?.amount || 0;
    console.log(`Overheads amount: ${overheadsAmount}`);

    // Create fallback rates map from profiles
    const profileRatesMap = new Map<string, number>();
    profiles?.forEach(p => profileRatesMap.set(p.id, p.hourly_rate || 0));

    // Function to get hourly rate at a specific date (replicates get_user_hourly_rate_at_date)
    const getHourlyRateAtDate = (userId: string, date: Date): number => {
      const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Find matching contract period
      const matchingPeriod = contractPeriods?.find(cp => {
        if (cp.user_id !== userId) return false;
        if (cp.start_date > dateStr) return false;
        if (cp.end_date && cp.end_date < dateStr) return false;
        return true;
      });

      if (matchingPeriod) {
        return matchingPeriod.hourly_rate || 0;
      }

      // Fallback to profiles table
      return profileRatesMap.get(userId) || 0;
    };

    const budgetItemToProject = new Map<string, string>();
    budgetItems?.forEach(bi => budgetItemToProject.set(bi.id, bi.project_id));

    // Calculate labor costs and confirmed hours per project (same formula as ProjectBudgetStats.tsx)
    // Consumo budget = ore confermate × (tariffa oraria utente alla data + overheads)
    const laborCostsPerProject = new Map<string, number>();
    const confirmedHoursPerProject = new Map<string, number>();
    
    timeTracking?.forEach(tt => {
      const projectId = budgetItemToProject.get(tt.budget_item_id);
      if (!projectId) return;

      const startTime = new Date(tt.actual_start_time);
      const endTime = new Date(tt.actual_end_time);
      const hoursWorked = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      
      // Use historical hourly rate based on the activity date
      const hourlyRate = getHourlyRateAtDate(tt.user_id, startTime);
      
      // Add overheadsAmount to hourly rate (not multiply as percentage)
      const laborCost = hoursWorked * (hourlyRate + overheadsAmount);

      const currentCost = laborCostsPerProject.get(projectId) || 0;
      laborCostsPerProject.set(projectId, currentCost + laborCost);
      
      const currentHours = confirmedHoursPerProject.get(projectId) || 0;
      confirmedHoursPerProject.set(projectId, currentHours + hoursWorked);
    });

    // Calculate external costs (products from budget_items) per project
    const externalCostsPerProject = new Map<string, number>();
    budgetItems?.forEach(bi => {
      if (bi.is_product) {
        const currentCost = externalCostsPerProject.get(bi.project_id) || 0;
        externalCostsPerProject.set(bi.project_id, currentCost + (bi.total_cost || 0));
      }
    });

    // Fetch additional costs from project_additional_costs table
    const { data: additionalCosts, error: additionalCostsError } = await supabaseAdmin
      .from('project_additional_costs')
      .select('project_id, amount')
      .in('project_id', projectIdsList);

    if (additionalCostsError) {
      console.error("Error fetching additional costs:", additionalCostsError);
      // Continue without additional costs rather than failing
    }

    // Add additional costs to external costs
    additionalCosts?.forEach(ac => {
      const currentCost = externalCostsPerProject.get(ac.project_id) || 0;
      externalCostsPerProject.set(ac.project_id, currentCost + (ac.amount || 0));
    });

    console.log(`Found ${additionalCosts?.length || 0} additional cost entries`);

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

    // Array to collect pack projects that need progress update
    const packProjectsToUpdate: { id: string; progress: number }[] = [];

    projects.forEach(project => {
      const laborCost = laborCostsPerProject.get(project.id) || 0;
      const externalCost = externalCostsPerProject.get(project.id) || 0;
      const confirmedHours = confirmedHoursPerProject.get(project.id) || 0;
      // laborCost already includes overheads (hourlyRate + overheadsAmount)
      const totalCost = laborCost + externalCost;
      const budget = project.total_budget || 0;
      // Use planned hours from budget_items instead of project.total_hours
      const totalHours = plannedHoursPerProject.get(project.id) || project.total_hours || 0;
      const marginPercentage = project.margin_percentage || 0;

      // Target Budget = Budget × (1 - margine%)
      // Questo è il budget che dovrebbe essere disponibile per coprire i costi (escludendo il margine target)
      const targetBudget = budget * (1 - marginPercentage / 100);

      // Margine Residuo % = (Budget Totale - Costi Sostenuti) / Budget Totale × 100
      // Rappresenta la percentuale del budget ancora disponibile rispetto al totale
      // Es: Budget 1650€, Costi 415.25€ → Margine Residuo = (1650 - 415.25) / 1650 × 100 = 74.83%
      let residualMargin = 100;
      if (budget > 0) {
        residualMargin = ((budget - totalCost) / budget) * 100;
      }

      // Calculate progress for pack projects (use billing_type = 'pack')
      // Note: progress can exceed 100% to show overtime
      let calculatedProgress = 0;
      const isPackProject = project.billing_type === 'pack';
      
      if (isPackProject && totalHours > 0) {
        calculatedProgress = Math.round((confirmedHours / totalHours) * 100);
        // Don't cap at 100% - allow overtime visibility
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

      console.log(`Project ${project.name}: budget=${budget}, marginPercentage=${marginPercentage}%, targetBudget=${targetBudget.toFixed(2)}, laborCost=${laborCost.toFixed(2)}, externalCost=${externalCost}, totalCost=${totalCost.toFixed(2)}, residualMargin=${residualMargin.toFixed(2)}%, confirmedHours=${confirmedHours.toFixed(2)}, totalHours=${totalHours}, billingType=${project.billing_type}${isPackProject ? `, progress=${calculatedProgress}%` : ''}`);
    });

    // Update progress for pack projects in the database
    if (packProjectsToUpdate.length > 0) {
      console.log(`Updating progress for ${packProjectsToUpdate.length} pack projects`);
      for (const { id, progress } of packProjectsToUpdate) {
        const { error: updateError } = await supabaseAdmin
          .from('projects')
          .update({ progress })
          .eq('id', id);
        
        if (updateError) {
          console.error(`Error updating progress for project ${id}:`, updateError);
        } else {
          console.log(`Updated progress for project ${id} to ${progress}%`);
        }
      }
    }

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
