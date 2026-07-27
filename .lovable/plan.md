# Obiettivo

Esporre via MCP un tool `list_time_entries` che permetta ad admin e team leader di leggere le ore confermate di altri utenti (aggirando la RLS che oggi limita `list_my_time_entries` al solo caller), mantenendo il principio del minimo privilegio.

# Approccio

Nuovo tool MCP che al suo interno:
1. Verifica il ruolo del caller tramite RPC `has_role(auth.uid(), 'admin')` / `has_role(auth.uid(), 'team_leader')`.
2. Se admin → può interrogare qualsiasi `user_id` / progetto / intervallo.
3. Se team_leader → limita i risultati agli utenti della propria area (`profiles.area` ∈ `team_leader_areas` del caller).
4. Se altro ruolo → forza `user_id = auth.uid()` (comportamento equivalente a `list_my_time_entries`, così il tool è utilizzabile anche dai member senza errori).

Per aggirare la RLS solo dopo il check di ruolo, uso un client con `SUPABASE_SERVICE_ROLE_KEY` **all'interno del tool**, applicando manualmente il filtro `user_id` derivato dal ruolo. Il service role non esce mai dall'edge function e non viene mai firmato nel token del caller.

# File toccati

- `src/lib/mcp/tools/list-time-entries.ts` — nuovo tool:
  - input: `user_id?` (uuid), `project_id?` (uuid), `from?`, `to?`, `limit?` (max 500)
  - output: array di entry con `user_id`, `budget_item_id`, `project_id` (via join), `actual_start_time`, `actual_end_time`, `hours`, `notes`
  - logica di autorizzazione descritta sopra; se il caller richiede un `user_id` non consentito → errore `forbidden`
- `src/lib/mcp/index.ts` — registrazione del nuovo tool nell'array `tools`
- `.lovable/mcp/manifest.json` — rigenerato automaticamente dal plugin Vite (non da editare a mano)

# Dettagli tecnici

- Per team leader: leggo `team_leader_areas` filtrato su `user_id = caller`, poi ricavo l'insieme di `profiles.id` con `area IN (...)` e filtro `activity_time_tracking.user_id` su quell'insieme.
- Aggrego `hours` in JS con lo stesso helper `hoursBetween` già usato in `project-summary.ts` per coerenza (nessuna dipendenza nuova).
- Solo entry con `actual_start_time` e `actual_end_time` non null (ore confermate, come richiesto).
- Nessuna modifica a RLS o schema DB.

# Sicurezza

- Uso del service role confinato al tool, dopo `has_role` esplicito sull'`auth.uid()` del caller MCP.
- Rifiuto esplicito di `user_id` fuori dallo scope consentito → risposta `isError: true` con messaggio "forbidden".
- Nessuna esposizione di tariffe orarie o campi contrattuali: seleziono solo colonne di time tracking.

# Verifica

Dopo il deploy della edge function `mcp` (automatico):
1. Test da client MCP come admin: `list_time_entries({ user_id: "<altro-utente>", from, to })` → ritorna dati.
2. Test come team leader su utente della propria area → dati; su utente fuori area → `forbidden`.
3. Test come member senza `user_id` → ritorna solo le proprie entry; con `user_id` di terzi → `forbidden`.
