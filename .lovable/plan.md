# Sincronizzazione Jethr → Progetto OFF

## Obiettivo

Quando una richiesta su Jethr viene approvata, deve apparire automaticamente nel calendario dell'utente come attività pianificata e confermata sul progetto **Larin OFF 2026**, sull'attività corrispondente al tipo Jethr (Ferie, Permesso, Malattia, ecc.). Gli eventi Google Calendar continuano a comparire come oggi (Jethr li pusha già nel Google personale dell'utente).

## Cosa cambia

### 1. Nuova tabella di mapping tipo Jethr → attività OFF

`jethr_activity_mappings`:
- `jethr_type` (text, PK) — es. `vacation`, `permission`, `sick_leave`
- `budget_item_id` (uuid, FK a `budget_items`) — attività del progetto OFF
- `enabled` (bool, default true)

Solo admin possono leggere/scrivere (RLS via `has_role`).

### 2. UI di gestione mapping

Nuova sezione dentro **Impostazioni → Integrazione Jethr** (`JethrIntegration.tsx`):
- Tabella con i tipi già visti in `jethr_absences.type` e in `jethr_pending_requests.type`, ognuno con un select sulle attività del progetto "Larin OFF 2026" (filtrate via `name ilike '%OFF%'`).
- Pulsante per aggiungere mapping manuali per tipi non ancora visti.
- Avviso accanto ad assenze sincronizzate ma con tipo non mappato.
- Mapping suggeriti iniziali (proposti, non hardcoded): `vacation`/`ferie` → Ferie, `permission`/`permesso` → Permesso, `sick_leave`/`malattia` → Malattia, `medical_visit` → Visita medica aziendale, `blood_donation` → Donazione sangue.

### 3. Estensione di `jethr-sync` (edge function esistente)

Dopo l'upsert in `jethr_absences` (sezione "ASSENZE APPROVATE"), per ogni assenza:

1. Risolvi `budget_item_id` dal mapping (`jethr_type` lowercased). Se manca: skip + summary `unmapped_types`.
2. Espandi il range `start_date → end_date` in giorni lavorativi (lun-ven, escludendo `company_closure_days`).
3. Per ogni giorno fai upsert in `activity_time_tracking`:
   - `user_id`, `budget_item_id`, `scheduled_date`, `confirmed = true`
   - `notes = "Sincronizzato da Jethr (jethr_id)"`
   - **Orari derivati dal contratto** (vedi sotto, sezione orari)
4. Tracciamento idempotente tramite junction table `jethr_absence_tracking(jethr_id text, scheduled_date date, tracking_id uuid, PK(jethr_id, scheduled_date))`. Permette idempotenza e cleanup.

### 4. Orari derivati dal contratto

Per ogni `(user_id, scheduled_date)`:
- Recupera `weekly_hours` da `user_contract_periods` valido alla data (la stessa logica già usata in `get_user_hourly_rate_at_date`, qui sul campo `weekly_hours`); fallback `40h`.
- **Assenza ad ore** (Jethr fornisce `start_time` + `end_time` o `hours` < ore giornaliere): usa quegli orari direttamente.
- **Assenza giornata intera**: durata = `weekly_hours / 5`, fascia centrata su 09:00 → `09:00 + (weekly_hours/5)`. Esempio: contratto 40h → `09:00 → 17:00`; 30h → `09:00 → 15:00`.

### 5. Cleanup richieste annullate

Estendere il cleanup già presente per i pending: per le `jethr_absences` non più presenti come `approved` su Jethr, eliminare la riga e — via junction — le `activity_time_tracking` collegate.

### 6. Riconciliazione iniziale

Bottone "Risincronizza assenze approvate" nella UI Jethr che richiama `jethr-manual-sync`. Una volta configurato il mapping, una sincronizzazione manuale popola lo storico esistente.

### 7. Festività

**Saltate**: l'API Jethr non le espone e per ora non vengono gestite manualmente. La tabella `jethr_holidays` resta vuota e non incide sul calendario.

## Note tecniche

- L'integrazione Google Calendar non viene toccata: gli eventi creati da Jethr nel Google dell'utente sono già visibili tramite `google-calendar-events`. La nuova logica popola `activity_time_tracking`, quindi le assenze finiscono anche in Timesheet/Workload sul progetto OFF.
- I conteggi ore esistenti su "Larin OFF" (banca ore/ferie già descritti in `mem://logic/time-off-and-hours-bank-recovery`) restano invariati: queste sono pianificazioni `confirmed=true`, gestite dalle stesse formule.
- Nessuna modifica alle policy RLS di `activity_time_tracking`: il sync gira con service role.
