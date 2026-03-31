import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');
    const hideUsers = url.searchParams.get('hide_users') === '1';

    if (!token) {
      return new Response(
        JSON.stringify({ error: 'Token mancante' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find project by share token
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, client_id, clients(name), timesheet_token_created_at, timesheet_token_expiry_days, billing_type, project_type')
      .eq('timesheet_share_token', token)
      .maybeSingle();

    if (projectError) {
      console.error('Error fetching project:', projectError);
      return new Response(
        JSON.stringify({ error: 'Errore nel recupero del progetto' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!project) {
      return new Response(
        JSON.stringify({ error: 'Link non valido o scaduto' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check token expiration (30 days)
    if (project.timesheet_token_created_at) {
      const tokenCreatedAt = new Date(project.timesheet_token_created_at);
      const now = new Date();
      const daysSinceCreation = (now.getTime() - tokenCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
      const expiryDays = project.timesheet_token_expiry_days || 30;
      const expiresAt = new Date(tokenCreatedAt.getTime() + expiryDays * 86400000).toISOString();
      if (daysSinceCreation > expiryDays) {
        return new Response(
          JSON.stringify({ error: 'Link scaduto. Richiedi un nuovo link al gestore del progetto.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Get budget items and adjustments in parallel
    const [budgetResult, adjustmentsResult] = await Promise.all([
      supabase
        .from('budget_items')
        .select('id, activity_name, category, hours_worked')
        .eq('project_id', project.id),
      supabase
        .from('project_timesheet_adjustments')
        .select('adjustment_type, target_id, percentage')
        .eq('project_id', project.id),
    ]);

    const { data: budgetItems, error: budgetError } = budgetResult;
    const { data: adjustments } = adjustmentsResult;

    if (budgetError) {
      console.error('Error fetching budget items:', budgetError);
      return new Response(
        JSON.stringify({ error: 'Errore nel recupero delle attività' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build adjustment maps
    const userAdjustments = new Map<string, number>();
    const categoryAdjustments = new Map<string, number>();
    for (const adj of (adjustments || [])) {
      if (adj.adjustment_type === 'user') {
        userAdjustments.set(adj.target_id, Number(adj.percentage) || 0);
      } else if (adj.adjustment_type === 'category') {
        categoryAdjustments.set(adj.target_id, Number(adj.percentage) || 0);
      }
    }

    if (!budgetItems?.length) {
      const expiresAtEmpty = project.timesheet_token_created_at
        ? new Date(new Date(project.timesheet_token_created_at).getTime() + (project.timesheet_token_expiry_days || 30) * 86400000).toISOString()
        : null;
      return new Response(
        JSON.stringify({ 
          project: { name: project.name, clientName: project.clients?.name || null, billingType: project.billing_type, projectType: project.project_type, expiresAt: expiresAtEmpty },
          timeEntries: [],
          totalAccountingHours: 0,
          activitySummary: [],
          hideUsers
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const budgetItemIds = budgetItems.map(bi => bi.id);

    // Get confirmed time entries only
    const { data: timeEntries, error: timeError } = await supabase
      .from('activity_time_tracking')
      .select('*')
      .in('budget_item_id', budgetItemIds)
      .not('actual_start_time', 'is', null)
      .not('actual_end_time', 'is', null)
      .order('scheduled_date', { ascending: false });

    if (timeError) {
      console.error('Error fetching time entries:', timeError);
      return new Response(
        JSON.stringify({ error: 'Errore nel recupero delle registrazioni' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profiles
    const userIds = [...new Set(timeEntries?.map(t => t.user_id) || [])];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', userIds);

    const profilesMap = new Map(
      profiles?.map(p => [p.id, { first_name: p.first_name, last_name: p.last_name }]) || []
    );

    const budgetItemsMap = new Map(
      budgetItems.map(bi => [bi.id, { activity_name: bi.activity_name, category: bi.category, hours_worked: bi.hours_worked }])
    );

    const calculateHours = (startTime: string | null, endTime: string | null): number => {
      if (!startTime || !endTime) return 0;
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      let duration = endMinutes - startMinutes;
      if (duration < 0) duration += 24 * 60;
      return Math.min(duration, 16 * 60) / 60;
    };

    const applyAdjustment = (baseHours: number, userId: string, category: string): number => {
      const userAdj = userAdjustments.get(userId) || 0;
      const catAdj = categoryAdjustments.get(category) || 0;
      return baseHours * (1 + (userAdj + catAdj) / 100);
    };

    // Map entries
    const mappedEntries = (timeEntries || []).map(entry => {
      const hours = calculateHours(entry.scheduled_start_time, entry.scheduled_end_time);
      const budgetItem = budgetItemsMap.get(entry.budget_item_id);
      const accountingHours = applyAdjustment(hours, entry.user_id, budgetItem?.category || '');
      const profile = profilesMap.get(entry.user_id);
      
      let noteText = '';
      if (entry.google_event_id && entry.google_event_title) {
        noteText = entry.google_event_title;
        if (entry.notes) noteText += '\n\n' + entry.notes;
      } else {
        noteText = entry.notes || '';
      }
      
      return {
        id: entry.id,
        scheduled_date: entry.scheduled_date,
        scheduled_start_time: entry.scheduled_start_time,
        scheduled_end_time: entry.scheduled_end_time,
        hours,
        accountingHours,
        userName: hideUsers ? undefined : (profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'N/A'),
        activityName: budgetItem?.activity_name || 'N/A',
        category: budgetItem?.category || 'N/A',
        notes: noteText,
        hasGoogleEvent: !!entry.google_event_id
      };
    });

    const totalAccountingHours = mappedEntries.reduce((acc, entry) => acc + entry.accountingHours, 0);

    // Build activity summary (aggregated by budget_item)
    const activityHoursMap: Record<string, { activityName: string; category: string; confirmedHours: number; budgetHours: number }> = {};
    for (const entry of (timeEntries || [])) {
      const bi = budgetItemsMap.get(entry.budget_item_id);
      if (!bi) continue;
      if (!activityHoursMap[entry.budget_item_id]) {
        activityHoursMap[entry.budget_item_id] = {
          activityName: bi.activity_name,
          category: bi.category,
          confirmedHours: 0,
          budgetHours: Number(bi.hours_worked) || 0
        };
      }
      const baseHours = calculateHours(entry.scheduled_start_time, entry.scheduled_end_time);
      activityHoursMap[entry.budget_item_id].confirmedHours += applyAdjustment(baseHours, entry.user_id, bi.category);
    }
    // Add budget items with no time entries
    for (const bi of (budgetItems || [])) {
      if (!activityHoursMap[bi.id]) {
        activityHoursMap[bi.id] = {
          activityName: bi.activity_name,
          category: bi.category,
          confirmedHours: 0,
          budgetHours: Number(bi.hours_worked) || 0
        };
      }
    }
    const activitySummary = Object.values(activityHoursMap);

    return new Response(
      JSON.stringify({
        project: { 
          name: project.name, 
          clientName: project.clients?.name || null,
          billingType: project.billing_type,
          projectType: project.project_type
        },
        timeEntries: mappedEntries,
        totalAccountingHours,
        activitySummary,
        hideUsers
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Errore interno del server' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
