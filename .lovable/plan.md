## Obiettivo
Rimuovere completamente l'integrazione JetHr dall'app: UI, edge function, tabelle DB, cron, colonne profilo e dati residui.

## 1. Frontend
- Rimuovere `src/components/JethrIntegration.tsx`.
- In `src/components/IntegrationsTab.tsx`: rimuovere import e `<JethrIntegration />`.
- Verificare che non esistano altri riferimenti in `src/` (grep conferma: solo i due file sopra + `types.ts` autogenerato — non da toccare a mano).

## 2. Edge Function
- Eliminare `supabase/functions/jethr-auto-link-events/` (rimozione file).
- Rimuovere il blocco `[functions.jethr-auto-link-events]` da `supabase/config.toml`.
- Chiamare `supabase--delete_edge_functions` per de-provisionare la funzione deployata.

## 3. Cron
- `SELECT cron.unschedule(...)` per eventuali job Jethr rimasti (`jethr-sync-hourly`, `jethr-auto-link-events-*`).

## 4. Database (migrazione)
Drop tabelle:
- `public.jethr_absence_mappings`
- `public.jethr_absence_tracking`
- `public.jethr_activity_mappings`
- `public.jethr_absences`
- `public.jethr_pending_requests`
- `public.jethr_holidays`
- `public.jethr_auto_link_log`

Drop colonna: `profiles.jethr_employee_id`.

Drop `app_settings` con `setting_key` in (`jethr_enabled`, `jethr_detection`, `jethr_slack_channel`, `jethr_default_times`).

Cleanup opzionale dati creati dall'integrazione: `DELETE FROM activity_time_tracking WHERE notes ILIKE '[JetHr]%'` (righe di assenze schedulate su "Larin OFF"). **Serve conferma** — vedi domanda sotto.

## 5. Note
Le migrazioni storiche in `supabase/migrations/*.sql` restano invariate (immutabili).

## Domanda aperta
Elimino anche le righe già inserite in `activity_time_tracking` con prefisso `[JetHr]` sul progetto "Larin OFF" (assenze storiche già pianificate)? Se no, restano come attività manuali nel timesheet.
