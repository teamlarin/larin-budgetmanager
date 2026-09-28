# Correzione: Sabrina Norcen non assegnabile ai progetti

## Causa (verificata)
Il profilo attivo di Sabrina (anagrafica storica, approvata) non ha un account di accesso associato: il suo login è un account separato. La tabella dei membri di progetto accetta solo utenti con account di accesso, quindi l'inserimento viene rifiutato.

Lo stesso vincolo esiste su altri punti in cui si sceglie una persona (project leader, account, assegnatario budget, notifiche), che darebbero lo stesso errore.

## Cosa cambia
- Sabrina (e in futuro chiunque abbia un'anagrafica senza login proprio) potrà essere aggiunta al team di progetto e scelta come project leader/account/assegnataria.
- Nessun dato esistente viene toccato.

## Dettagli tecnici
Migrazione: sostituire le foreign key verso `auth.users(id)` con foreign key verso `public.profiles(id)` (ON DELETE CASCADE / SET NULL mantenendo il comportamento attuale) su:
- `project_members.user_id`
- `projects.project_leader_id`, `projects.account_user_id`, `projects.assigned_user_id`
- `budgets.assigned_user_id`
- `notifications.user_id`, `notification_preferences.user_id`

Prima della migrazione, verificare che tutti i valori esistenti siano presenti in `profiles` (altrimenti il vincolo non si crea). Gli altri vincoli verso `auth.users` (ruoli, esterni, creatori di record) restano invariati perché riguardano chi effettua l'accesso.

Verifica finale: inserimento di Sabrina nel team del progetto corrente.
