

## Notifica assegnazione budget

### Obiettivo
Quando il campo `assigned_user_id` di un budget viene modificato (assegnato a un utente), inviare una notifica in-app all'utente assegnato.

### Implementazione

**Migrazione SQL**: creare un trigger sulla tabella `budgets` che intercetta le modifiche al campo `assigned_user_id`, analogo al trigger `notify_project_leader_assignment` già esistente per i progetti.

Il trigger:
1. Si attiva solo quando `assigned_user_id` cambia e il nuovo valore non è null
2. Non notifica se l'utente si sta auto-assegnando
3. Recupera il nome del budget dalla tabella `budgets`
4. Inserisce una notifica in-app nella tabella `notifications` con tipo `budget_assigned`, titolo "Budget assegnato" e messaggio che include il nome del budget
5. Rispetta le preferenze di notifica dell'utente (tabella `notification_preferences`)

### Dettagli tecnici

- **Funzione**: `notify_budget_assignment()` — trigger `AFTER UPDATE` sulla tabella `budgets`
- **Condizione**: `OLD.assigned_user_id IS DISTINCT FROM NEW.assigned_user_id AND NEW.assigned_user_id IS NOT NULL`
- **Tipo notifica**: `budget_assigned`
- Solo notifica in-app, nessuna email aggiuntiva (coerente con il pattern delle assegnazioni attività)

Nessuna modifica al codice frontend — il sistema di notifiche in-app già esistente mostrerà automaticamente la nuova notifica nella campanella.

