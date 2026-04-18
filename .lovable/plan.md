

## Diagnosi completa notifiche

### Cosa funziona
- `pack_hours_warning` / `pack_hours_overtime` — trigger DB, OK (ultime: 17/04)
- `activity_assignment` — trigger su `budget_items` esiste, ma 0 notifiche storiche (nessuno cambia assegnazione? va verificato in test)
- `budget_assigned` / `project_leader_assigned` — trigger esistono su `budgets` e `projects`, ma 0 notifiche storiche
- Cron `sync-budget-drafts` (job 10/11/12) — leggono `CRON_SECRET` dal Vault → OK

### Cosa è rotto

**1. Trigger `notify_budget_status_change` sulla tabella SBAGLIATA**
È collegato a `public.projects`, dovrebbe essere su `public.budgets`. Risultato: nessun `budget_pending` / `budget_approved` / `budget_rejected` da quando i budget sono stati separati dalla tabella projects.

**2. Cinque cron jobs usano un Bearer token obsoleto**
I job 5, 6, 7, 8, 9 hanno il token hardcoded `qO_3qdV3ODMO6AZ4iRbFIKE1ZKVs065ep9xPkcpwOJo` nello schedule SQL. Le edge function corrispondenti validano `Bearer <CRON_SECRET>` e rispondono **401**. Questo spiega perché non arrivano da settimane:
- `check-margin-alerts` → niente `margin_warning` / `margin_critical` / `projection_*` (ultima: 02/01)
- `check-project-deadlines` → niente `deadline_overdue` / `deadline_approaching` (ultima: 06/01)
- `send-progress-reminder` → niente `progress_reminder` (ultima: 19/03, probabilmente coincidente con ultima rotazione del secret)
- `send-weekly-planning-reminder` → niente `weekly_planning_reminder` (ultima: 19/03)
- `send-weekly-ai-summary` → niente `weekly_ai_summary` (ultima: 12/03)
- `send-monthly-timesheet-reminder` (job 3) — stesso problema, ma è solo email

**3. Email da trigger DB silenziose** (problema noto già nel piano precedente)
`notify_project_leader_assignment` e `notify_project_completed_webhook` leggono `current_setting('app.settings.supabase_url')` e `service_role_key` che sono `NULL`. La notifica in-app parte (se trigger esiste), ma email/webhook no.

---

## Fix

### Migration SQL unica

**A.** Sposta `trigger_notify_budget_status_change` da `projects` a `budgets`.

**B.** Riscrive i 6 cron jobs (5, 6, 7, 8, 9, 3) per leggere `CRON_SECRET` e `SUPABASE_URL` dal Vault, allineandoli al pattern di `sync-budget-drafts` (job 10/11/12).

**C.** Riscrive le 2 funzioni trigger (`notify_project_leader_assignment`, `notify_project_completed_webhook`) per leggere url + service_role_key da `vault.decrypted_secrets` invece dei GUC mai configurati.

### Verifica post-fix
- Cambio stato budget di test → notifica `budget_pending` agli admin/team_leader
- Cambio a `approvato` → notifica creatore + email Mandrill
- Assegnazione Project Leader → notifica in-app + email
- Attesa cron giornaliero (08:00 / 08:30 / 09:00) → notifiche margin/deadline/progress riprendono

### File modificati
- 1 migration SQL (sposta trigger + risistema 6 cron + riscrive 2 funzioni)
- Nessuna modifica frontend o edge functions

