## Problema

Dai log della edge function `mcp` le chiamate degli strumenti falliscono **immediatamente**:

```
tool.invoked { tool: "list_projects", outcome: "handler_error", durationMs: 0.53 }
tool.invoked { tool: "list_my_time_entries", outcome: "handler_error", durationMs: 0.29 }
```

L'autenticazione OAuth funziona (`oauth.verify.ok` con il tuo utente), quindi il collegamento a Claude è a posto. L'errore avviene prima di qualsiasi query (0,3 ms = eccezione sincrona).

Causa: tutti i tool creano il client Supabase con `process.env.SUPABASE_PUBLISHABLE_KEY`, ma nelle Edge Function Supabase inietta `SUPABASE_ANON_KEY` — quella variabile non esiste, `createClient` riceve `undefined` e lancia. Risultato: **nessuno strumento MCP funziona**, non solo quelli sulle ore.

Secondo problema: anche una volta risolto, Claude non ha modo di passare da "Francesco Ferrari" a uno `user_id` (UUID). `list_time_entries` accetta solo `user_id`, quindi non riuscirebbe comunque a rispondere.

## Cosa fare

1. **Fix chiave Supabase nei tool MCP** (`src/lib/mcp/tools/*.ts`): leggere la chiave anon con fallback `SUPABASE_PUBLISHABLE_KEY ?? SUPABASE_ANON_KEY`, e lanciare un errore leggibile (restituito come `isError`) se manca, invece di far crashare l'handler.

2. **Nuovo tool `find_users`**: ricerca per nome/cognome/email su `profiles` (solo utenti approvati), restituisce `id, nome, email, area, ruolo`. Rispetta lo stesso controllo di ruolo di `list_time_entries` (admin = tutti, team leader = solo le proprie aree, altri = solo sé stesso), e non espone colonne di compenso.

3. **`list_time_entries`: aggiungere il parametro `user_search`** come alternativa a `user_id`, così Claude può chiedere direttamente "ore di Francesco Ferrari". Se la ricerca è ambigua (più match) il tool restituisce l'elenco dei candidati invece di indovinare. Aggiungere anche un riepilogo aggregato (ore totali, per progetto) nel `structuredContent` per rendere l'analisi più diretta.

4. **Aggiornare `instructions` in `src/lib/mcp/index.ts`** citando `find_users` come passo preliminare.

5. **Rigenerare il manifest** (`app_mcp_server--extract_mcp_manifest`) e **rideployare** la function `mcp`. Poi in Claude bisogna ricaricare/riconnettere il connettore per vedere i nuovi tool.

## Verifica

- Chiamata diretta di `list_projects` e `list_time_entries` sulla function deployata, controllando che i log mostrino `outcome: "ok"`.
- Confronto delle ore restituite per Francesco Ferrari con quelle mostrate in TimeTrap.

## Note tecniche

- Nessuna modifica a RLS o allo schema: il controllo di accesso resta quello attuale (verifica ruolo via RPC `has_role`, poi query con service role già ristretta al set di utenti consentito).
- `find_users` non usa la service role per allargare la visibilità oltre lo scope già consentito dal ruolo del chiamante.
