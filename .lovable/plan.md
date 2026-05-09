# Integrazione Jethr (HRIS) → TimeTrap

Read-only da Jethr verso TimeTrap, cron orario. Jethr resta source of truth per HR; TimeTrap consuma i dati per anagrafica/contratti, calendario assenze, festività e widget richieste pending.

## Ambito sync

1. **Anagrafica & contratti** → `profiles` + `user_contract_periods`
2. **Assenze approvate** (ferie, permessi, malattia — **escluso smart working**) → eventi calendario / time-off
3. **Festività & chiusure aziendali** → `app_settings.closure_days`
4. **Richieste pending** → nuova tabella + widget dashboard admin/team-leader

## Mapping utenti TimeTrap ↔ Jethr (manuale)

⚠️ Le email non coincidono (TimeTrap = aziendali, Jethr = personali). Serve un binding esplicito.

- Aggiungere colonna `profiles.jethr_employee_id` (text, unique nullable)
- In **Impostazioni → Utenti**, ogni riga utente avrà un nuovo dropdown "Dipendente Jethr" che lista i dipendenti Jethr non ancora associati (caricati via edge function `jethr-list-employees`)
- Suggerimento automatico opzionale per match nome+cognome (>0.8 similarity) ma sempre confermato dall'admin
- Senza binding → l'utente è ignorato dal sync (loggato in `jethr_sync_status.unmatched`)
- Nuovo edge function `jethr-list-employees` (chiamata on-demand da UI, non dal cron)

## Setup credenziali

- Sezione **Impostazioni → Integrazioni → Jethr** (nuovo `JethrIntegration.tsx` accanto a Fatture in Cloud / HubSpot)
- L'admin genera in Jethr (Impostazioni azienda → API → Le mie applicazioni) un token Bearer
- Salvato come secret `JETHR_API_TOKEN`
- UI mostra: stato connessione, "Test connessione", "Sincronizza ora", timestamp ultimo sync per area, conteggio utenti non mappati con link rapido alla pagina Utenti

## Architettura edge functions

```text
┌─────────────────────────────────────────┐
│ pg_cron (ogni ora) → jethr-sync         │
└─────────────────────────────────────────┘
              │
   ┌──────────┼──────────┬──────────────┐
   ▼          ▼          ▼              ▼
contracts  absences   holidays      pending-requests
   │          │          │              │
   ▼          ▼          ▼              ▼
profiles   jethr_     app_settings   jethr_pending_
+ contract  absences   closure_days   requests
periods    + calendar
            events
```

Edge functions (tutte `verify_jwt = false`, protette via `CRON_SECRET` Bearer come gli altri job — vedi mem `Edge Functions Auth`):

- `jethr-sync` — orchestratore, chiama in sequenza i 4 sync sui soli utenti con `jethr_employee_id` valorizzato, aggiorna `app_settings.jethr_sync_status` (last_sync, count per area, errori, lista utenti non mappati)
- `jethr-list-employees` — listing dipendenti Jethr per il binding manuale (richiede auth admin)
- `jethr-test-connection` — chiamata da UI Integrazioni
- `jethr-manual-sync` — pulsante "Sincronizza ora", riusa orchestratore

Helper condiviso `supabase/functions/_shared/jethr.ts` con `jethrFetch(path)` + retry + paginazione.

## Mapping dati

### 1. Contratti → user_contract_periods

- Solo per `profiles` con `jethr_employee_id` valorizzato
- Sync ore settimanali, hourly_rate, data inizio/fine contratto → upsert in `user_contract_periods`
- Aggiungere colonna `user_contract_periods.source` (text default 'manual', valori: `manual`|`jethr`) per non sovrascrivere override manuali. Re-sync tocca solo i record con `source = 'jethr'`
- **Non** sovrascrivere `profiles.first_name`, `last_name`, `email`, avatar (sono dati TimeTrap-specifici)

### 2. Assenze → calendar events + nuova tabella

Filtro lato Jethr: tipi `ferie`, `permesso`, `malattia` (escluso smart working).

Nuova tabella `jethr_absences`:
- `jethr_id` (unique), `user_id` (FK profiles), `type`, `start_date`, `end_date`, `start_time`/`end_time` se parziale, `status = 'approved'`, `hours`, `synced_at`

Integrazione calendario:
- Per ogni assenza approvata creare/aggiornare evento in `calendar_events` con `source = 'jethr'` e `jethr_absence_id` (FK), così appaiono nel calendario utente come blocco read-only
- Il widget "Carico di lavoro team" già esclude i time-off → vede automaticamente le assenze come ore non disponibili (sostituisce in pratica la logica manuale "Larin OFF")

### 3. Festività → app_settings.closure_days

- Merge con i giorni configurati a mano; quelli importati taggati `source: 'jethr'`
- Re-sync sostituisce solo gli `source: 'jethr'`, lascia intatti Pasqua/Pasquetta calcolate e i giorni manuali

### 4. Richieste pending → jethr_pending_requests

Nuova tabella + widget `JethrPendingRequestsWidget` in dashboard admin/team-leader: mostra ferie/permessi non ancora approvati che ricadono in date con progetti attivi/scadenze. Read-only, link diretto a Jethr per approvare.

## Migration DB

- `profiles.jethr_employee_id` (text, unique nullable)
- `user_contract_periods.source` (text default 'manual')
- `calendar_events.source` (text nullable) + `calendar_events.jethr_absence_id` (uuid, unique nullable)
- `jethr_absences` con RLS: utente vede le proprie, admin/team-leader vedono tutte
- `jethr_pending_requests` con RLS: admin + team-leader della stessa area
- `app_settings` row `jethr_sync_status` (JSON)

## Cron

```sql
select cron.schedule(
  'jethr-sync-hourly',
  '0 * * * *',
  $$ select net.http_post(
    url:='https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/jethr-sync',
    headers:='{"Content-Type":"application/json","Authorization":"Bearer <CRON_SECRET>"}'::jsonb
  ); $$
);
```

## UI

- `src/components/JethrIntegration.tsx` (card in `IntegrationsTab`) — connessione, stato, sync manuale, lista utenti non mappati
- Modifica `src/components/UserManagement.tsx` — colonna/dropdown "Dipendente Jethr" per ogni utente, con suggerimento per nome+cognome
- `src/components/dashboards/JethrPendingRequestsWidget.tsx` — widget dashboard per admin/team-leader
- Eventi calendario assenze: badge colorato per tipo, non editabili in TimeTrap (read-only)

## Verifica

1. Test connessione → 200 + numero dipendenti restituiti
2. Mappare 2-3 utenti, lanciare sync manuale → controllare `user_contract_periods` aggiornati e assenze visibili in calendario
3. Caso Giulia Sordi: dopo binding+sync, le 30h di maggio devono apparire in `user_contract_periods` con `source='jethr'`
4. Una ferie approvata in Jethr appare in calendario entro 1h e azzera la capacità nel widget Carico di lavoro
5. Utenti senza `jethr_employee_id` restano gestiti a mano, nessun side-effect

## Out of scope

- Smart working (escluso esplicitamente)
- Scrittura verso Jethr
- Sync timesheet TimeTrap → Jethr
- Webhook real-time
