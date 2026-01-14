import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get('token');

    if (!token) {
      console.error('Missing token parameter');
      return new Response(
        JSON.stringify({ error: 'Token mancante' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching timesheet for token:', token);

    // Create Supabase client with service role for bypassing RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find project by share token
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, name, client_id, clients(name), timesheet_token_created_at')
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
      console.error('Project not found for token:', token);
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
      
      if (daysSinceCreation > 30) {
        console.error('Token expired for project:', project.name);
        return new Response(
          JSON.stringify({ error: 'Link scaduto. Richiedi un nuovo link al gestore del progetto.' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    console.log('Found project:', project.name);

    // Get budget items for this project
    const { data: budgetItems, error: budgetError } = await supabase
      .from('budget_items')
      .select('id, activity_name, category')
      .eq('project_id', project.id);

    if (budgetError) {
      console.error('Error fetching budget items:', budgetError);
      return new Response(
        JSON.stringify({ error: 'Errore nel recupero delle attività' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!budgetItems?.length) {
      console.log('No budget items found');
      return new Response(
        JSON.stringify({ 
          project: { name: project.name, clientName: project.clients?.name || null },
          timeEntries: [],
          totalAccountingHours: 0
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

    console.log('Found time entries:', timeEntries?.length || 0);

    // Get user profiles for the entries
    const userIds = [...new Set(timeEntries?.map(t => t.user_id) || [])];
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, first_name, last_name')
      .in('id', userIds);

    const profilesMap = new Map(
      profiles?.map(p => [p.id, { first_name: p.first_name, last_name: p.last_name }]) || []
    );

    const budgetItemsMap = new Map(
      budgetItems.map(bi => [bi.id, { activity_name: bi.activity_name, category: bi.category }])
    );

    // Calculate hours for each entry
    const calculateHours = (startTime: string | null, endTime: string | null): number => {
      if (!startTime || !endTime) return 0;
      const [startH, startM] = startTime.split(':').map(Number);
      const [endH, endM] = endTime.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;
      return (endMinutes - startMinutes) / 60;
    };

    // Map entries with calculated hours
    const mappedEntries = (timeEntries || []).map(entry => {
      const hours = calculateHours(entry.scheduled_start_time, entry.scheduled_end_time);
      const profile = profilesMap.get(entry.user_id);
      const budgetItem = budgetItemsMap.get(entry.budget_item_id);
      
      // Combine Google event title and notes/description
      let noteText = '';
      if (entry.google_event_id && entry.google_event_title) {
        noteText = entry.google_event_title;
        if (entry.notes) {
          noteText += '\n\n' + entry.notes;
        }
      } else {
        noteText = entry.notes || '';
      }
      
      return {
        id: entry.id,
        scheduled_date: entry.scheduled_date,
        scheduled_start_time: entry.scheduled_start_time,
        scheduled_end_time: entry.scheduled_end_time,
        hours,
        userName: profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() : 'N/A',
        activityName: budgetItem?.activity_name || 'N/A',
        category: budgetItem?.category || 'N/A',
        notes: noteText,
        hasGoogleEvent: !!entry.google_event_id
      };
    });

    const totalAccountingHours = mappedEntries.reduce((acc, entry) => acc + entry.hours, 0);

    console.log('Total accounting hours:', totalAccountingHours);

    return new Response(
      JSON.stringify({
        project: { 
          name: project.name, 
          clientName: project.clients?.name || null 
        },
        timeEntries: mappedEntries,
        totalAccountingHours
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
