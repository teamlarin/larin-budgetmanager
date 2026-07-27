## Problema

Su un progetto (es. *CDL Marketing operativo 2026*) due utenti vedono valori di budget residuo / margine residuo diversi.

## Causa (verificata)

Il calcolo dei costi confermati moltiplica ore × `hourly_rate` dell'utente che ha tracciato l'attività. Le tariffe vengono lette via `fetchProfilesCompensation`, che invoca la RPC `get_profiles_compensation`. Questa RPC — introdotta con l'hardening `profiles_sensitive_columns_broad_select` — restituisce `hourly_rate` **solo** se il chiamante è `admin` / `finance` / `team_leader`; a tutti gli altri torna soltanto la propria riga.

Effetto pratico:
- Tu (admin/team_leader/finance) → tariffe di tutti → costi confermati completi → residuo "vero".
- Alessia (member/account/coordinator) → tariffa solo la sua → costi degli altri contati come 0 → `totalSpent` più basso → **residuo più alto**.

Componenti impattati dallo stesso pattern:
- `src/pages/ProjectCanvas.tsx` (KPI Margine residuo)
- `src/components/ProjectBudgetStats.tsx` (statistiche budget)
- eventuali altre viste che usano `fetchProfilesCompensation` per il costing

## Piano di correzione

1. **Nuova RPC `get_hourly_rates_for_costing(_user_ids uuid[])`** in Supabase:
   - `SECURITY DEFINER`, `search_path = public`.
   - Ritorna `(id uuid, hourly_rate numeric)` per tutti gli ID richiesti.
   - Autorizzata a qualunque utente autenticato **approvato** (`is_approved_user(auth.uid())`), che è già la condizione per vedere il progetto.
   - Non espone `contract_type`, `contract_hours`, `contract_hours_period` — quelli restano ristretti in `get_profiles_compensation`.
   - `GRANT EXECUTE ... TO authenticated`.

2. **Helper frontend** `fetchHourlyRatesForCosting(userIds)` in `src/lib/profilesCompensation.ts` che chiama la nuova RPC.

3. **Aggiornare i punti di costing** a usare il nuovo helper (invece di `fetchProfilesCompensation`):
   - `ProjectCanvas.tsx` → query `kpiUserProfiles`.
   - `ProjectBudgetStats.tsx` → query dei profili per il costing.
   - Grep di controllo su altri usi (`ProjectTimesheet.tsx` risulta già ok perché usa la RPC storica `get_user_hourly_rate_at_date`, che è SECURITY DEFINER senza check di ruolo — verifico e lascio invariata).

4. **Nessuna modifica** a `get_profiles_compensation` né alle GRANT di `profiles`: i campi contrattuali restano ristretti come oggi.

## Verifica

- Query manuale con due sessioni (admin e member) sulla stessa RPC per confermare che entrambi ottengono le stesse tariffe.
- Ricaricare la pagina progetto con l'account Alessia e confrontare il residuo con il tuo.

## Note tecniche

Il rischio "esposizione tariffe orarie a tutti gli approvati" è accettabile perché la tariffa è già l'input di calcolo mostrato negli stessi KPI finanziari del canvas/budget stats a cui questi utenti hanno accesso; l'hardening originario mirava alle informazioni contrattuali (tipo contratto, ore, periodo), che restano protette.