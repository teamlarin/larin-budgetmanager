# Le mie task nella dashboard personale

Aggiungere alla dashboard personale un elenco delle task assegnate all'utente, su tutti i progetti, ordinate per data di scadenza.

## Cosa vedrà l'utente

Nuovo box "Le mie task" nel tab "Il mio Recap" della dashboard, sopra i grafici:

- Task raggruppate per scadenza: **In ritardo**, **Oggi**, **Domani**, **Questa settimana**, **Più avanti**, **Senza scadenza**.
- Ogni riga mostra: titolo, progetto (con cliente), priorità, stato, data di scadenza.
- Le task completate sono escluse per default, con un interruttore per mostrarle.
- Checkbox per segnare una task come completata direttamente dalla dashboard.
- Click sulla riga: apre il progetto sul tab Task.
- Contatore in testata (es. "3 in ritardo, 2 oggi") e stato vuoto ("Nessuna task assegnata").
- Limite iniziale di 10 task con pulsante "Mostra tutte".

## Dettagli tecnici

- Nuovo hook `src/hooks/useMyTasks.ts`: query React Query (`['my-tasks', userId]`) su `project_tasks` filtrata per `assignee_id = userId`, `status != 'completata'` (o tutti se richiesto), con join su `projects(id, name, clients(name))`, ordinata per `due_date` ascendente (nulls last) e priorità. Riuso dei tipi da `src/lib/projectTaskSort.ts`.
- Raggruppamento in bucket per scadenza calcolato con `date-fns` (`format(date, 'yyyy-MM-dd')`, mai `toISOString()`), coerente con la regola progetto sui fusi orari.
- Nuovo componente `src/components/dashboards/MyTasksWidget.tsx` (Card, badge priorità/stato con i token esistenti, nessun colore hardcoded).
- Mutazione di completamento: update di `status` + `completed_at` su `project_tasks`, invalidazione di `['my-tasks']` e `['project-tasks', projectId]`.
- Inserimento del widget in `src/components/dashboards/MemberDashboard.tsx` (visibile quindi in tutti i ruoli che usano `TabbedDashboard`), con `userId` passato dalle props esistenti se disponibile, altrimenti aggiunto come prop opzionale da `Dashboard.tsx`.

## Nota sui permessi

Le policy RLS di `project_tasks` mostrano le task solo a chi ha accesso al progetto (leader, membro, o ruoli admin/team_leader/coordinator/account/finance). Se una persona con ruolo `member` viene assegnata a una task di un progetto di cui non è membro, quella task non le sarà visibile: in quel caso serve aggiungerla ai membri del progetto (nessuna modifica alle policy prevista in questo intervento).
