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
      .select('id, name, total_budget, margin_percentage, project_type, total_hours')
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

    // Fetch all budget items for these projects
    const { data: budgetItems, error: budgetItemsError } = await supabaseAdmin
      .from('budget_items')
      .select('id, project_id, is_product, total_cost, vat_rate')
      .in('project_id', projectIdsList);

    if (budgetItemsError) {
      console.error("Error fetching budget items:", budgetItemsError);
      throw budgetItemsError;
    }

    console.log(`Found ${budgetItems?.length || 0} budget items`);

    const budgetItemIds = budgetItems?.map(bi => bi.id) || [];

    // Fetch ALL time tracking data using service role (bypasses RLS)
    // Use pagination to avoid the 1000 row limit
    let allTimeTracking: any[] = [];
    const batchSize = 1000;
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
      const { data: timeTrackingBatch, error: timeTrackingError } = await supabaseAdmin
        .from('activity_time_tracking')
        .select('budget_item_id, actual_start_time, actual_end_time, user_id')
        .in('budget_item_id', budgetItemIds)
        .not('actual_start_time', 'is', null)
        .not('actual_end_time', 'is', null)
        .range(offset, offset + batchSize - 1);

      if (timeTrackingError) {
        console.error("Error fetching time tracking:", timeTrackingError);
        throw timeTrackingError;
      }

      if (timeTrackingBatch && timeTrackingBatch.length > 0) {
        allTimeTracking = [...allTimeTracking, ...timeTrackingBatch];
        offset += batchSize;
        hasMore = timeTrackingBatch.length === batchSize;
      } else {
        hasMore = false;
      }
    }

    const timeTracking = allTimeTracking;
    console.log(`Found ${timeTracking?.length || 0} time tracking entries (paginated)`);

    // Fetch user hourly rates
    const userIds = [...new Set(timeTracking?.map(tt => tt.user_id) || [])];
    const { data: profiles, error: profilesError } = await supabaseAdmin
      .from('profiles')
      .select('id, hourly_rate')
      .in('id', userIds);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    // Fetch overheads from app settings (same as ProjectBudgetStats.tsx)
    const { data: overheadSetting } = await supabaseAdmin
      .from('app_settings')
      .select('setting_value')
      .eq('setting_key', 'overheads')
      .maybeSingle();

    // overheadsAmount is an absolute value added to hourly rate, not a percentage
    const overheadsAmount = (overheadSetting?.setting_value as { amount?: number })?.amount || 0;
    console.log(`Overheads amount: ${overheadsAmount}`);

    // Create lookup maps
    const userRatesMap = new Map<string, number>();
    profiles?.forEach(p => userRatesMap.set(p.id, p.hourly_rate || 0));

    const budgetItemToProject = new Map<string, string>();
    budgetItems?.forEach(bi => budgetItemToProject.set(bi.id, bi.project_id));

    // Calculate labor costs and confirmed hours per project (same formula as ProjectBudgetStats.tsx)
    // Consumo budget = ore confermate × (tariffa oraria utente + overheads)
    const laborCostsPerProject = new Map<string, number>();
    const confirmedHoursPerProject = new Map<string, number>();
    
    timeTracking?.forEach(tt => {
      const projectId = budgetItemToProject.get(tt.budget_item_id);
      if (!projectId) return;

      const startTime = new Date(tt.actual_start_time).getTime();
      const endTime = new Date(tt.actual_end_time).getTime();
      const hoursWorked = (endTime - startTime) / (1000 * 60 * 60);
      const hourlyRate = userRatesMap.get(tt.user_id) || 0;
      // Add overheadsAmount to hourly rate (not multiply as percentage)
      const laborCost = hoursWorked * (hourlyRate + overheadsAmount);

      const currentCost = laborCostsPerProject.get(projectId) || 0;
      laborCostsPerProject.set(projectId, currentCost + laborCost);
      
      const currentHours = confirmedHoursPerProject.get(projectId) || 0;
      confirmedHoursPerProject.set(projectId, currentHours + hoursWorked);
    });

    // Calculate external costs (products) per project
    const externalCostsPerProject = new Map<string, number>();
    budgetItems?.forEach(bi => {
      if (bi.is_product) {
        const currentCost = externalCostsPerProject.get(bi.project_id) || 0;
        externalCostsPerProject.set(bi.project_id, currentCost + (bi.total_cost || 0));
      }
    });

    // Calculate margins
    const margins: Record<string, { 
      residualMargin: number; 
      laborCost: number; 
      externalCost: number; 
      totalCost: number;
      budget: number;
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
      const totalHours = project.total_hours || 0;

      // Margine Residuo = (Budget - Costi Confermati) / Budget × 100
      let residualMargin = 100;
      if (budget > 0) {
        residualMargin = ((budget - totalCost) / budget) * 100;
      }

      // Calculate progress for pack projects (only project_type containing 'pack')
      let calculatedProgress = 0;
      const isPackProject = (project.project_type || '').toLowerCase().includes('pack');
      
      if (isPackProject && totalHours > 0) {
        calculatedProgress = Math.round((confirmedHours / totalHours) * 100);
        calculatedProgress = Math.min(calculatedProgress, 100);
        packProjectsToUpdate.push({ id: project.id, progress: calculatedProgress });
      }

      margins[project.id] = {
        residualMargin: Math.round(residualMargin * 100) / 100,
        laborCost: Math.round(laborCost * 100) / 100,
        externalCost: Math.round(externalCost * 100) / 100,
        totalCost: Math.round(totalCost * 100) / 100,
        budget,
        confirmedHours: Math.round(confirmedHours * 100) / 100,
        totalHours,
        projectType: project.project_type || '',
      };

      console.log(`Project ${project.name}: budget=${budget}, laborCost=${laborCost.toFixed(2)}, externalCost=${externalCost}, totalCost=${totalCost.toFixed(2)}, residualMargin=${residualMargin.toFixed(2)}%, confirmedHours=${confirmedHours.toFixed(2)}, totalHours=${totalHours}${isPackProject ? `, progress=${calculatedProgress}%` : ''}`);
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
