import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SCHEMA_CONTEXT = `
Sei un assistente AI per TimeTrap, un'applicazione di project management e time tracking.
Hai accesso al database e puoi eseguire query SQL per rispondere alle domande degli utenti.

Tabelle principali:
- projects: id, name, description, status (budget_status enum: bozza/in_attesa/approvato/rifiutato/completato/archiviato), project_type, client_id, user_id, account_user_id, project_leader_id, start_date, end_date, total_budget, total_hours, progress, billing_type, discipline, area, margin_percentage, discount_percentage, is_billable, project_status (project_status enum: on_track/at_risk/blocked/completed)
- budget_items: id, project_id, budget_id, activity_name, category, hours_worked, hourly_rate, total_cost, assignee_id, assignee_name, is_product, display_order, duration_days, start_day_offset
- activity_time_tracking: id, budget_item_id, user_id, scheduled_date, scheduled_start_time, scheduled_end_time, actual_start_time, actual_end_time, notes
- clients: id, name, email, phone, notes, strategic_level, account_user_id
- profiles: id, email, first_name, last_name, area, approved, title
- user_roles: user_id, role (app_role enum: admin/account/finance/team_leader/member/coordinator)
- quotes: id, quote_number, budget_id, project_id, total_amount, discounted_total, status, discount_percentage, margin_percentage
- notifications: id, user_id, type, title, message, read, project_id
- budgets: id, name, status, client_id, total_budget, total_hours, margin_percentage, discount_percentage, discipline, area
- project_members: id, project_id, user_id
- project_additional_costs: id, project_id, name, amount, supplier_id
- suppliers: id, name, email, category
- services: id, name, code, category, net_price, gross_price
- products: id, name, code, category, net_price, gross_price
- levels: id, name, hourly_rate, areas
- project_progress_updates: id, project_id, user_id, progress_value, update_text, roadblocks_text

Relazioni chiave:
- projects.client_id -> clients.id
- budget_items.project_id -> projects.id
- activity_time_tracking.budget_item_id -> budget_items.id
- activity_time_tracking.user_id -> profiles.id
- project_members.project_id -> projects.id, project_members.user_id -> profiles.id

Rispondi SEMPRE in italiano. Sii conciso e chiaro. Formatta i numeri in modo leggibile.
Quando calcoli le ore confermate, usa: EXTRACT(EPOCH FROM (actual_end_time - actual_start_time)) / 3600.
Per le ore pianificate dal time tracking: calcola dalla differenza tra scheduled_end_time e scheduled_start_time (sono di tipo TIME).
`;

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

    // Verify user
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

    // Check if approved
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("approved, first_name")
      .eq("id", user.id)
      .single();

    if (!profile?.approved) {
      return new Response(JSON.stringify({ error: "Utente non approvato" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Step 1: Ask AI what SQL queries to run
    const planResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: SCHEMA_CONTEXT + `\nL'utente corrente è: ${profile.first_name} (id: ${user.id}).
Genera le query SQL necessarie per rispondere alla domanda. Usa SOLO SELECT. Mai DELETE/UPDATE/INSERT/DROP.
Limita i risultati con LIMIT quando appropriato. Usa nomi di tabella con schema "public.".`,
            },
            ...messages,
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "execute_queries",
                description:
                  "Execute SQL SELECT queries against the TimeTrap database to gather data for answering the user's question.",
                parameters: {
                  type: "object",
                  properties: {
                    queries: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          label: {
                            type: "string",
                            description: "Short label for this query",
                          },
                          sql: {
                            type: "string",
                            description: "SELECT SQL query",
                          },
                        },
                        required: ["label", "sql"],
                      },
                    },
                  },
                  required: ["queries"],
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "execute_queries" },
          },
        }),
      }
    );

    if (!planResponse.ok) {
      const errText = await planResponse.text();
      console.error("AI plan error:", planResponse.status, errText);
      
      if (planResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Troppi richieste, riprova tra poco." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const planData = await planResponse.json();
    const toolCall = planData.choices?.[0]?.message?.tool_calls?.[0];
    
    let queryResults: Record<string, any> = {};
    
    if (toolCall?.function?.arguments) {
      const { queries } = JSON.parse(toolCall.function.arguments);
      
      // Execute each query with service role (read-only validation)
      for (const q of queries) {
        const rawSql = typeof q.sql === "string" ? q.sql : "";
        const sanitizedSql = rawSql.trim().replace(/;+$/g, "");

        console.log(`Executing query [${q.label}]:`, sanitizedSql);

        if (!sanitizedSql) {
          queryResults[q.label] = { error: "Query vuota o non valida" };
          continue;
        }

        const sqlLower = sanitizedSql.toLowerCase();
        if (!sqlLower.startsWith("select") && !sqlLower.startsWith("with")) {
          queryResults[q.label] = { error: "Solo query SELECT sono permesse" };
          continue;
        }

        // Block multiple statements
        if (sanitizedSql.includes(";")) {
          queryResults[q.label] = { error: "Query non permessa: statement multipli non consentiti" };
          continue;
        }

        // Block dangerous keywords
        if (/\b(delete|drop|insert|update|alter|truncate|create)\b/i.test(sanitizedSql)) {
          queryResults[q.label] = { error: "Query non permessa" };
          continue;
        }
        
        try {
          // Use REST API with user's JWT so RLS policies apply
          const pgRes = await fetch(`${supabaseUrl}/rest/v1/rpc/execute_readonly_query`, {
            method: "POST",
            headers: {
              Authorization: authHeader!,
              apikey: supabaseAnonKey,
              "Content-Type": "application/json",
              "Prefer": "return=representation",
            },
            body: JSON.stringify({ query_text: sanitizedSql }),
          });
          
          if (!pgRes.ok) {
            const errBody = await pgRes.text();
            console.error(`Query [${q.label}] failed:`, pgRes.status, errBody);
            queryResults[q.label] = { error: `Query fallita (${pgRes.status}): ${errBody}` };
          } else {
            const result = await pgRes.json();
            console.log(`Query [${q.label}] returned ${Array.isArray(result) ? result.length : 'non-array'} results`);
            queryResults[q.label] = result;
          }
        } catch (e) {
          console.error(`Query [${q.label}] exception:`, e);
          queryResults[q.label] = { error: String(e) };
        }
      }
    }

    // Step 2: Send results back to AI for final answer (streaming)
    const answerResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: SCHEMA_CONTEXT + "\nRispondi basandoti sui dati del database forniti. Usa markdown per formattare la risposta. Sii conciso.",
            },
            ...messages,
            {
              role: "assistant",
              content: `Ho eseguito le seguenti query sul database. Ecco i risultati:\n\n${JSON.stringify(queryResults, null, 2)}`,
            },
            {
              role: "user",
              content: "Basandoti sui risultati delle query, rispondi alla mia domanda precedente in modo chiaro e conciso in italiano.",
            },
          ],
          stream: true,
        }),
      }
    );

    if (!answerResponse.ok) {
      if (answerResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Troppi richieste, riprova tra poco." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (answerResponse.status === 402) {
        return new Response(JSON.stringify({ error: "Crediti AI esauriti." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI answer error");
    }

    return new Response(answerResponse.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("ai-agent error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Errore sconosciuto",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
