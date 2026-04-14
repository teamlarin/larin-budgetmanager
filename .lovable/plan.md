

## Precompilazione campi dinamici nella scheda Performance

### Problema
Quando si crea una nuova scheda performance, i campi ruolo, team e team leader sono vuoti e vanno compilati manualmente, ma questi dati esistono già nel sistema.

### Mappatura dati

| Campo performance | Fonte |
|---|---|
| `job_title` (Ruolo) | `profiles.title` dell'utente selezionato |
| `team` | `profiles.area` dell'utente selezionato |
| `team_leader_name` | Nome del team leader che ha quell'area in `team_leader_areas` |

### Modifiche

**`src/components/PerformanceReviewManagement.tsx`**:

1. Nella funzione `openCreate()`, dopo aver impostato `user_id`, fare una query per recuperare il profilo dell'utente selezionato (`title`, `area`)
2. Con l'`area` ottenuta, cercare in `team_leader_areas` il team leader corrispondente e recuperarne il nome da `profiles`
3. Popolare `form.job_title`, `form.team` e `form.team_leader_name` con i valori trovati
4. I campi restano editabili nel dialog, così l'admin può sovrascriverli se necessario

### Nessuna modifica al database.

