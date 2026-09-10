# Notifiche per le task

Oggi le task di progetto non generano alcuna notifica: esistono avvisi per attività previste, budget, progetti e scadenze, ma nulla per le task operative. Aggiungiamo una famiglia di notifiche dedicate, coerente con quelle già presenti (campanella in app + preferenze nel profilo).

## Eventi notificati

1. **Task assegnata** — a ogni persona aggiunta come assegnataria (mai a chi si assegna da solo).
2. **Cambio di stato** — quando lo stato passa a Da fare / In corso / Bloccato: avviso agli assegnatari e al project leader, escluso chi ha fatto la modifica.
3. **Task completata** — quando lo stato diventa Completato: avviso al project leader e agli assegnatari, escluso chi la completa.
4. **Scadenza imminente** — promemoria il giorno prima della scadenza, per le task non completate, agli assegnatari.
5. **Scadenza superata** — promemoria una volta al giorno per le task scadute e non completate.
6. **Assegnatario rimosso** — nessuna notifica (rumore inutile).

Ogni notifica riporta titolo della task, progetto e, dove utile, chi ha fatto la modifica, e cliccandola si apre il progetto sulla task.

## Preferenze utente

Nel profilo compare un nuovo gruppo **Task** con le voci: Task assegnata, Cambio di stato task, Task completata, Scadenza task. Come per le altre notifiche, ognuna è attivabile/disattivabile e di default è attiva.

## Dettagli tecnici

- **Nuovi tipi**: `task_assigned`, `task_status_changed`, `task_completed`, `task_due_soon`, `task_overdue`. Passano da `notify_user_if_enabled`, così le preferenze valgono automaticamente.
- **Trigger DB**:
  - `project_task_assignees` AFTER INSERT → notifica assegnazione (autore = `auth.uid()`, escluso).
  - `project_tasks` AFTER UPDATE OF `status` → notifica cambio stato o completamento; destinatari = assegnatari da `project_task_assignees` + `projects.project_leader_id`, deduplicati, escluso `auth.uid()`.
  - Funzioni `SECURITY DEFINER SET search_path = public`, tolleranti a task senza progetto o senza assegnatari.
- **Promemoria scadenze**: estendere la Edge Function `check-project-deadlines` (già schedulata) con un blocco task — `due_date = domani` → `task_due_soon`, `due_date < oggi` e stato diverso da `done` → `task_overdue`, con dedup giornaliero controllando le notifiche già create nelle 20 ore precedenti per lo stesso utente/tipo/task.
- **Frontend**: aggiungere il gruppo Task in `src/pages/Profile.tsx`, le etichette e le icone dei nuovi tipi in `src/pages/Notifications.tsx` (e nel dropdown della campanella), più le voci nel filtro Tipo.
- **Link**: la notifica resta collegata al progetto (`project_id`), come le altre; nessuna colonna nuova su `notifications`.
- Verifiche: typecheck, test e build.
