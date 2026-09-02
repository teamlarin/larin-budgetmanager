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

const HELP_KNOWLEDGE_BASE = `
GUIDA TIMETRAP — Knowledge base per domande "come funziona X" / "come si fa Y".
Quando l'utente chiede COME usare la piattaforma (non dati specifici), rispondi da questa knowledge base
e cita SEMPRE il link alla sezione corrispondente nel formato: [Apri la guida](/help#<id>).

## Concetti
- BUDGET (#man-budget): budget interni con attività, ore, costi orari, data chiusura attesa, prodotti collegati
  (solo prodotti allineati a Fatture in Cloud: i servizi sono dismessi). All'approvazione genera automaticamente
  un'OFFERTA IN BOZZA: il pulsante "Genera preventivo" non esiste più.
  Alert progressivi al 50/75/90/100% di consumo + alert di proiezione (>10% / >25% sforamento previsto).
- OFFERTE (#man-offerte): documento commerciale UNICO e versionato che sostituisce i vecchi Preventivi
  (la sezione Preventivi e il modello multi-budget quote_budgets non esistono più). Titolo e numero modificabili
  (con controllo duplicati), righe prodotto con titolo e descrizione editabili ma sempre agganciate a un prodotto
  di listino per le statistiche, categoria di ricavo scelta da elenco (default dal prodotto), esito manuale
  (Accettata/Rifiutata con data e note), link pubblico con firma del cliente, PDF, invio a Fatture in Cloud.
  All'accettazione crea automaticamente progetto e cartella Drive e scrive il numero offerta nel progetto.
- FINANZA (#man-finanza): menu visibile solo a admin/account/finance con Cruscotto vendite, Offerte, Gare,
  Fatture, Abbonamenti (incluso monitor siti WpZen) e Costo personale (solo admin/finance).
- TASK DI PROGETTO (#man-task): task con scadenze, priorità (Alta/Normale/Bassa), stati (Da fare, In corso,
  In revisione, Completato), assegnatari multipli, descrizione rich-text con immagini, ricorrenze, drag & drop,
  collegamento obbligatorio a un'attività prevista del budget, widget "Le mie task" e CTA rapida nell'header.

- PROGETTI (#man-progetti): nascono da budget approvato. Hanno project leader, team, attività pianificate,
  maggiorazioni timesheet (% per utente o categoria), Budget Target = 70% del costo attività,
  progress automatico per progetti recurring/pack.
- PROGETTI APPROVATI (#man-approved-projects): pagina dedicata con semaforo di criticità
  (rosso se >85% budget consumato, <7gg deadline o margine basso).
- CALENDARIO/PLANNER (#man-calendario): vista giornaliera e Planner settimanale, drag-drop attività e task
  dalla sidebar, spostamento tra settimane, conferma ore dal Planner, controllo conflitti, ricorrenza,
  vista multi-utente, timesheet pubblica con token (scadenza configurabile, flag "nascondi dettagli").
- WORKLOAD (#man-workload): carico settimanale per utente con previsionale.
- WORKFLOWS (#man-workflows): flussi di task con dipendenze (dependsOn), commenti, scadenze individuali, lock a cascata.
- PERFORMANCE REVIEWS (#man-performance): scheda annuale con obiettivi (con bonus %), note trimestrali,
  punti di forza, aree di miglioramento, leadership/sales.
- BANCA ORE (#man-hours-bank): saldo = (ore confermate + rettifiche) - ore attese - ore recuperate.
  ore confermate = tempo confermato nel periodo (incluse Larin OFF e attività di banca ore);
  rettifiche = correzioni manuali mensili (+/-) dell'admin; ore attese = ore dovute da contratto e periodi
  contrattuali, al netto delle chiusure aziendali; ore recuperate = ore già prese come recupero banca ore.
  ATTENZIONE: "ore attese" (da contratto) NON sono le "ore pianificate" a calendario, che non entrano nel saldo.
  Riporti dall'anno precedente, dettaglio mensile, previsionale (saldo a fine mese stimato sommando le ore
  pianificate a calendario nei giorni restanti).
- IMPOSTAZIONI (#man-impostazioni): utenti, livelli, aree, periodi contrattuali dinamici,
  External users (collaboratori esterni via magic link), listino prodotti sincronizzato da Fatture in Cloud,
  Slack, FIC, Google Sheet sync, HubSpot, API pubblica e server MCP, Google Drive.

## Ruoli (#ruoli-permessi)
- Admin: accesso completo, può simulare altri ruoli.
- Account: read-only su finanziari progetti, gestione clienti propri, budget e offerte.
- Finance: nessuna dashboard dedicata; usa il menu Finanza (cruscotto, offerte, gare, fatture, abbonamenti, costo personale).
- Team Leader: dashboard 3 tab (Recap/Progetti/Team) sui membri della propria area.
- Coordinator: gestione catalog (clienti, contatti, fornitori, prodotti, template) + budget read-only.
- Member: solo Calendario e Progetti dove è leader o membro (RLS lato DB).
- External: collaboratore esterno con accesso a singoli progetti via magic link.


## Automazioni (#ai-automazioni)
- Notifiche budget progressive 50/75/90/100% + proiezione sforamento.
- Promemoria automatici: timesheet mensile, pianificazione settimanale, margini critici.
- Riepilogo settimanale AI ogni lunedì 09:00 via email.
- Slack su 3 scenari: nuovo progetto, aggiornamenti progress, completamento.
- Webhook Make su completamento progetto.
- AI Insights personalizzati per ruolo nella dashboard.

## FAQ rapide (#faq)
- "Non vedo il mio progetto nel dialog Nuova attività" → solo progetti 'aperto' in cui sei leader o membro.
- "Banca ore strana" → controlla periodi contrattuali (ore attese variabili), le rettifiche mensili e che 'Larin OFF' non sia escluso.
- "Dove sono i Preventivi?" → dismessi: tutto è in Finanza → Offerte (#man-offerte), con offerta in bozza automatica dal budget.
- "Notifiche non arrivano" → verifica preferences in Profilo + rate limit email Supabase (1/min).
- "Sync Sheet/HubSpot non aggiorna" → cron ogni 6h (clienti) o 3x/giorno (budget drafts).
- "Prodotto non trovato nell'offerta" → il listino arriva da Fatture in Cloud (sync notturno): i servizi non esistono più.


REGOLE:
1. Se la domanda è OPERATIVA SUI DATI ("quanti progetti ho?", "ore di Mario", "budget cliente X")
   → genera query SQL come al solito.
2. Se la domanda è "COME FUNZIONA X" / "COME FACCIO Y" / "DOVE TROVO Z"
   → NON eseguire query, rispondi dalla knowledge base e includi il link [Apri la guida](/help#<id>).
3. Se la domanda è IBRIDA → fai entrambi: query + spiegazione + link.
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
          model: "google/gemini-3.1-pro-preview",
          messages: [
            {
              role: "system",
              content: SCHEMA_CONTEXT + HELP_KNOWLEDGE_BASE + `\nL'utente corrente è: ${profile.first_name} (id: ${user.id}).
Se la domanda riguarda DATI specifici dell'utente (progetti, ore, budget, clienti, scadenze)
chiama lo strumento execute_queries con SOLO query SELECT. Mai DELETE/UPDATE/INSERT/DROP.
Limita i risultati con LIMIT quando appropriato. Usa nomi di tabella con schema "public.".
Se invece la domanda è "come funziona X" / "come si fa Y" / "dove trovo Z" / "cos'è Y",
NON chiamare execute_queries: lascia che il prossimo step risponda dalla knowledge base.`,
            },
            ...messages,
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "execute_queries",
                description:
                  "Execute SQL SELECT queries against the TimeTrap database to gather data for answering data-related user questions. Do NOT call this for 'how-to' or platform documentation questions.",
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
          tool_choice: "auto",
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
    const sources: Array<{
      label: string;
      tables: string[];
      period: string | null;
      rows: number | null;
      error?: string;
    }> = [];

    const extractTables = (sql: string): string[] => {
      const found = new Set<string>();
      const re = /\b(?:from|join)\s+(?:public\.)?("?[a-zA-Z_][a-zA-Z0-9_]*"?)/gi;
      let m: RegExpExecArray | null;
      while ((m = re.exec(sql)) !== null) {
        const name = m[1].replace(/"/g, "");
        if (!/^(select|lateral)$/i.test(name)) found.add(name);
      }
      const rpc = /\b(?:rpc\.)?(get_[a-zA-Z0-9_]+|execute_readonly_query)\s*\(/gi;
      while ((m = rpc.exec(sql)) !== null) found.add(`${m[1]}()`);
      return Array.from(found);
    };

    const extractPeriod = (sql: string): string | null => {
      const dates = sql.match(/\d{4}-\d{2}-\d{2}/g);
      if (dates && dates.length > 0) {
        const sorted = [...new Set(dates)].sort();
        return sorted.length === 1 ? sorted[0] : `${sorted[0]} → ${sorted[sorted.length - 1]}`;
      }
      const rel = sql.match(/(current_date|now\(\)|date_trunc\('[a-z]+'[^)]*\))/i);
      if (rel) {
        const interval = sql.match(/interval\s+'([^']+)'/i);
        return interval ? `relativo a oggi (${interval[1]})` : "relativo a oggi";
      }
      return null;
    };


    
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

        const res = queryResults[q.label];
        sources.push({
          label: q.label,
          tables: extractTables(sanitizedSql),
          period: extractPeriod(sanitizedSql),
          rows: Array.isArray(res) ? res.length : null,
          ...(res && !Array.isArray(res) && res.error ? { error: String(res.error) } : {}),
        });
      }

      // Query scartate dalla validazione (uscite con `continue`)
      for (const q of queries) {
        if (sources.some((s) => s.label === q.label)) continue;
        const res = queryResults[q.label];
        sources.push({
          label: q.label,
          tables: extractTables(typeof q.sql === "string" ? q.sql : ""),
          period: extractPeriod(typeof q.sql === "string" ? q.sql : ""),
          rows: null,
          error: res?.error ? String(res.error) : "Query non eseguita",
        });
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
          model: "google/gemini-3.1-pro-preview",
          messages: [
            {
              role: "system",
              content: SCHEMA_CONTEXT + HELP_KNOWLEDGE_BASE + `
Rispondi in italiano usando markdown, sii conciso.
- Se hai dati delle query, basa la risposta su quei dati.
- Per domande "come funziona / come si fa / dove trovo", rispondi dalla knowledge base e includi
  SEMPRE almeno un link nel formato [Apri la guida](/help#<id>) alla sezione pertinente.`,
            },
            ...messages,
            ...(Object.keys(queryResults).length > 0
              ? [
                  {
                    role: "assistant" as const,
                    content: `Ho eseguito le seguenti query sul database. Ecco i risultati:\n\n${JSON.stringify(queryResults, null, 2)}`,
                  },
                  {
                    role: "user" as const,
                    content: "Basandoti sui risultati delle query, rispondi alla mia domanda precedente in modo chiaro e conciso in italiano.",
                  },
                ]
              : []),
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

    // Prepend un evento SSE con le fonti usate, poi inoltra lo stream del modello
    const encoder = new TextEncoder();
    const upstream = answerResponse.body!;
    const stream = new ReadableStream({
      async start(controller) {
        if (sources.length > 0) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ tt_sources: sources })}\n\n`)
          );
        }
        const reader = upstream.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
      cancel(reason) {
        return upstream.cancel(reason);
      },
    });

    return new Response(stream, {
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
