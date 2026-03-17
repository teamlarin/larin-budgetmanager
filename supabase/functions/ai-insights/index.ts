import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify user
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non autorizzato" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Get user profile and role
    const [profileRes, roleRes] = await Promise.all([
      adminClient.from("profiles").select("first_name, last_name, area, approved").eq("id", user.id).single(),
      adminClient.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
    ]);

    if (!profileRes.data?.approved) {
      return new Response(JSON.stringify({ error: "Utente non approvato" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userRole = roleRes.data?.role || "member";
    const userName = `${profileRes.data.first_name || ""} ${profileRes.data.last_name || ""}`.trim();

    // Block external users
    if (userRole === "external") {
      return new Response(JSON.stringify({ error: "Non autorizzato per utenti esterni" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Collect context data based on role
    const today = new Date().toISOString().split("T")[0];
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const monthEnd = new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0];

    const queries: Record<string, string> = {};

    // Projects with upcoming deadlines (all roles)
    queries.projects_near_deadline = `
      SELECT p.id, p.name, p.end_date, p.progress, p.project_status, p.status,
             c.name as client_name, p.total_hours, p.total_budget,
             prof.first_name || ' ' || prof.last_name as leader_name
      FROM public.projects p
      LEFT JOIN public.clients c ON c.id = p.client_id
      LEFT JOIN public.profiles prof ON prof.id = p.project_leader_id
      WHERE p.status = 'approvato'
        AND p.end_date IS NOT NULL
        AND p.end_date <= '${monthEnd}'
        AND p.end_date >= '${today}'
      ORDER BY p.end_date ASC
      LIMIT 15
    `;

    // Projects at risk
    queries.projects_at_risk = `
      SELECT p.id, p.name, p.project_status, p.progress, p.end_date,
             c.name as client_name
      FROM public.projects p
      LEFT JOIN public.clients c ON c.id = p.client_id
      WHERE p.status = 'approvato'
        AND (p.project_status IN ('at_risk', 'blocked') OR p.progress < 30 AND p.end_date <= '${weekEnd}')
      LIMIT 10
    `;

    // Role-specific queries
    if (["admin", "team_leader", "coordinator"].includes(userRole)) {
      // Team leader: filter by assigned areas
      if (userRole === "team_leader") {
        const { data: leaderAreas } = await adminClient
          .from("team_leader_areas")
          .select("area")
          .eq("user_id", user.id);
        
        const userArea = profileRes.data.area;
        const areas = leaderAreas?.map((a: any) => a.area) || [];
        if (userArea && !areas.includes(userArea)) areas.push(userArea);
        
        if (areas.length > 0) {
          const areasFilter = areas.map((a: string) => `'${a}'`).join(",");
          queries.team_workload = `
            SELECT p.id as user_id, p.first_name, p.last_name, p.area,
                   p.contract_hours, p.contract_type,
                   COALESCE(SUM(
                     EXTRACT(EPOCH FROM (att.scheduled_end_time::time - att.scheduled_start_time::time)) / 3600
                   ), 0) as planned_hours_this_week
            FROM public.profiles p
            LEFT JOIN public.activity_time_tracking att ON att.user_id = p.id
              AND att.scheduled_date >= '${today}'
              AND att.scheduled_date <= '${weekEnd}'
            WHERE p.approved = true AND p.deleted_at IS NULL
              AND p.area IN (${areasFilter})
            GROUP BY p.id, p.first_name, p.last_name, p.area, p.contract_hours, p.contract_type
            HAVING p.contract_hours IS NOT NULL
            ORDER BY planned_hours_this_week DESC
            LIMIT 30
          `;
        }
      } else {
        // Admin/coordinator: all users
        queries.team_workload = `
          SELECT p.id as user_id, p.first_name, p.last_name, p.area,
                 p.contract_hours, p.contract_type,
                 COALESCE(SUM(
                   EXTRACT(EPOCH FROM (att.scheduled_end_time::time - att.scheduled_start_time::time)) / 3600
                 ), 0) as planned_hours_this_week
          FROM public.profiles p
          LEFT JOIN public.activity_time_tracking att ON att.user_id = p.id
            AND att.scheduled_date >= '${today}'
            AND att.scheduled_date <= '${weekEnd}'
          WHERE p.approved = true AND p.deleted_at IS NULL
          GROUP BY p.id, p.first_name, p.last_name, p.area, p.contract_hours, p.contract_type
          HAVING p.contract_hours IS NOT NULL
          ORDER BY planned_hours_this_week DESC
          LIMIT 30
        `;
      }
    }

    // Budget health (for admin, account, finance)
    if (["admin", "account", "finance"].includes(userRole)) {
      queries.budget_health = `
        SELECT p.id, p.name, p.total_budget, p.total_hours, p.margin_percentage,
               c.name as client_name,
               COALESCE(SUM(
                 EXTRACT(EPOCH FROM (att.actual_end_time - att.actual_start_time)) / 3600
               ), 0) as confirmed_hours,
               COALESCE(SUM(bi.hours_worked), 0) as planned_hours
        FROM public.projects p
        LEFT JOIN public.clients c ON c.id = p.client_id
        LEFT JOIN public.budget_items bi ON bi.project_id = p.id AND (bi.is_product IS NULL OR bi.is_product = false)
        LEFT JOIN public.activity_time_tracking att ON att.budget_item_id = bi.id
          AND att.actual_start_time IS NOT NULL AND att.actual_end_time IS NOT NULL
        WHERE p.status = 'approvato'
        GROUP BY p.id, p.name, p.total_budget, p.total_hours, p.margin_percentage, c.name
        HAVING COALESCE(SUM(bi.hours_worked), 0) > 0
        ORDER BY CASE WHEN COALESCE(SUM(bi.hours_worked), 0) > 0 
          THEN COALESCE(SUM(EXTRACT(EPOCH FROM (att.actual_end_time - att.actual_start_time)) / 3600), 0) / NULLIF(SUM(bi.hours_worked), 0)
          ELSE 0 END DESC
        LIMIT 15
      `;
    }

    // Account-specific: quotes pipeline and client activity
    if (["account", "admin"].includes(userRole)) {
      queries.quotes_pipeline = `
        SELECT q.id, q.quote_number, q.status, q.total_amount, q.discounted_total,
               q.generated_at, b.name as budget_name, c.name as client_name
        FROM public.quotes q
        LEFT JOIN public.budgets b ON b.id = q.budget_id
        LEFT JOIN public.clients c ON c.id = b.client_id
        WHERE q.status IN ('draft', 'sent')
        ORDER BY q.generated_at DESC
        LIMIT 10
      `;

      queries.budgets_pending = `
        SELECT b.id, b.name, b.status, b.total_budget, b.created_at,
               c.name as client_name,
               prof.first_name || ' ' || prof.last_name as assigned_to
        FROM public.budgets b
        LEFT JOIN public.clients c ON c.id = b.client_id
        LEFT JOIN public.profiles prof ON prof.id = b.assigned_user_id
        WHERE b.status IN ('in_attesa', 'in_revisione', 'bozza')
        ORDER BY b.created_at DESC
        LIMIT 10
      `;
    }

    // User's own activities this week (for members)
    if (userRole === "member") {
      queries.my_week_activities = `
        SELECT att.scheduled_date, att.scheduled_start_time, att.scheduled_end_time,
               att.actual_start_time, att.actual_end_time,
               bi.activity_name, bi.category,
               p.name as project_name
        FROM public.activity_time_tracking att
        JOIN public.budget_items bi ON bi.id = att.budget_item_id
        LEFT JOIN public.projects p ON p.id = bi.project_id
        WHERE att.user_id = '${user.id}'
          AND att.scheduled_date >= '${today}'
          AND att.scheduled_date <= '${weekEnd}'
        ORDER BY att.scheduled_date, att.scheduled_start_time
        LIMIT 50
      `;
    }

    // Execute all queries
    const queryResults: Record<string, any> = {};
    for (const [label, sql] of Object.entries(queries)) {
      try {
        const pgRes = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_readonly_query`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: supabaseAnonKey,
            "Content-Type": "application/json",
            Prefer: "return=representation",
          },
          body: JSON.stringify({ query_text: sql.trim().replace(/;+$/g, "") }),
        });

        if (pgRes.ok) {
          queryResults[label] = await pgRes.json();
        } else {
          const errBody = await pgRes.text();
          console.error(`Query [${label}] failed:`, errBody);
          queryResults[label] = [];
        }
      } catch (e) {
        console.error(`Query [${label}] exception:`, e);
        queryResults[label] = [];
      }
    }

    // Role-specific system prompts
    const rolePrompts: Record<string, string> = {
      admin: `Hai visibilità completa su tutti i progetti, budget, risorse e finanze. Concentrati su:
- Problemi operativi critici (progetti in ritardo, risorse sovraccariche)
- Salute finanziaria (margini, budget overrun)
- Decisioni strategiche (priorità, allocazione risorse)`,
      account: `Ti occupi di gestione clienti, preventivi e pipeline commerciale. Concentrati su:
- Preventivi in attesa di risposta o da inviare
- Budget da completare o revisionare
- Progetti dei tuoi clienti vicini alla scadenza
- Opportunità commerciali e follow-up`,
      finance: `Ti occupi di aspetti finanziari e marginalità. Concentrati su:
- Progetti con margini a rischio o in calo
- Budget con ore consuntivate che superano il pianificato
- Andamento finanziario complessivo
- Costi fuori budget`,
      team_leader: `Gestisci un team e le relative risorse. Concentrati su:
- Distribuzione del carico di lavoro nel tuo team
- Membri sovraccarichi o sottoutilizzati
- Progetti del tuo team vicini alla scadenza
- Attività non confermate o in ritardo`,
      coordinator: `Coordini le operazioni tra più team. Concentrati su:
- Distribuzione workload tra i team
- Colli di bottiglia operativi
- Progetti cross-team a rischio
- Risorse condivise e conflitti di pianificazione`,
      member: `Sei un membro del team. Concentrati su:
- Le tue attività della settimana e la loro organizzazione
- Attività non ancora confermate
- Progetti a cui partecipi vicini alla scadenza
- Suggerimenti per ottimizzare il tuo tempo`,
    };

    // Send to AI for structured insights
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const roleContext = rolePrompts[userRole] || rolePrompts.member;

    const systemPrompt = `Sei un assistente AI per TimeTrap, un'applicazione di project management.
L'utente corrente è: ${userName} (ruolo: ${userRole}).
Data odierna: ${today}.

${roleContext}

Analizza i dati forniti e genera insight azionabili. Ogni insight deve avere:
- category: "planning" | "resources" | "budget" | "risk"
- priority: "high" | "medium" | "low"  
- title: breve titolo (max 60 char)
- description: descrizione dettagliata con dati specifici (nomi, numeri, date)
- action: azione suggerita concreta

Genera tra 3 e 8 insight. Concentrati sui problemi più urgenti e le opportunità più impattanti.
Rispondi SOLO con la chiamata alla funzione, non aggiungere testo.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Ecco i dati dal database di TimeTrap:\n\n${JSON.stringify(queryResults, null, 2)}\n\nGenera insight basati su questi dati.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "generate_insights",
              description: "Generate structured AI insights for the TimeTrap dashboard",
              parameters: {
                type: "object",
                properties: {
                  insights: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        category: { type: "string", enum: ["planning", "resources", "budget", "risk"] },
                        priority: { type: "string", enum: ["high", "medium", "low"] },
                        title: { type: "string" },
                        description: { type: "string" },
                        action: { type: "string" },
                      },
                      required: ["category", "priority", "title", "description", "action"],
                    },
                  },
                },
                required: ["insights"],
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "generate_insights" } },
      }),
    });

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Troppe richieste, riprova tra poco." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await aiResponse.text();
      console.error("AI error:", aiResponse.status, errText);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];

    let insights: any[] = [];
    if (toolCall?.function?.arguments) {
      try {
        const parsed = JSON.parse(toolCall.function.arguments);
        insights = parsed.insights || [];
      } catch (e) {
        console.error("Failed to parse AI insights:", e);
      }
    }

    return new Response(JSON.stringify({ insights, generated_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-insights error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Errore sconosciuto" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
