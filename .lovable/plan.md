## Obiettivo
Azzerare l'integrazione Jethr per poterla ricostruire da zero.

## 1. Frontend
- Elimino `src/components/JethrIntegration.tsx`
- Elimino `src/components/dashboards/JethrPendingRequestsWidget.tsx`
- In `src/components/IntegrationsTab.tsx`: rimuovo import + blocco `<JethrIntegration />` (commento "Jethr (HRIS)")
- In `src/pages/Dashboard.tsx`: rimuovo import + le due occorrenze di `<JethrPendingRequestsWidget ... />` (linee 1668 e 1779)

## 2. Edge Functions
Elimino le cartelle e deregistro le funzioni deployate:
- `supabase/functions/jethr-test-connection`
- `supabase/functions/jethr-list-employees`
- `supabase/functions/jethr-sync`
- `supabase/functions/jethr-manual-sync`
- `supabase/functions/_shared/jethr.ts`

Rimuovo i blocchi `[functions.jethr-*]` da `supabase/config.toml`.

## 3. Database (migrazione)
Una migrazione di pulizia che:
- Deregistra il cron `jethr-sync-hourly` (`cron.unschedule`)
- `DROP TABLE` (CASCADE) di:
  - `public.jethr_absence_tracking`
  - `public.jethr_activity_mappings`
  - `public.jethr_pending_requests`
  - `public.jethr_absences`
  - `public.jethr_holidays`
- `ALTER TABLE public.profiles DROP COLUMN IF EXISTS jethr_employee_id`

## 4. Secret
Rimuovo (se presenti) i secret `JETHR_API_TOKEN` / eventuali altri `JETHR_*` dopo conferma.

## 5. Memoria progetto
Rimuovo da `mem://index.md` la voce "Jethr HRIS" e cancello `mem://integrations/jethr-hris`.

## Dettagli tecnici
- L'eliminazione delle cartelle edge richiede `supabase--delete_edge_functions` con i 4 nomi.
- La `DROP` con CASCADE rimuove anche eventuali policy/indici residui.
- Il file `src/integrations/supabase/types.ts` si rigenera automaticamente dopo la migrazione: non lo tocco.

## Conferma richiesta
Procedo con il piano sopra? In particolare confermi:
1. Cancellazione dati nelle tabelle `jethr_*` (irreversibile)
2. Rimozione della colonna `profiles.jethr_employee_id`
3. Rimozione del secret `JETHR_API_TOKEN`
