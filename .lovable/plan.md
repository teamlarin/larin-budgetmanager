

## Campi read-only e storico contratti nella sezione Performance

### Modifiche

**1. Rendere Ruolo, Team e Team Leader non modificabili** (`PerformanceReviewManagement.tsx`)

Nel dialog di modifica profilo professionale (righe 676-689), aggiungere `disabled` e classe `bg-muted` ai tre campi: Ruolo (`job_title`), Team (`team`) e Team Leader (`team_leader_name`). Questi vengono sempre derivati dal profilo utente e dalla gerarchia team leader, quindi non devono essere editabili manualmente.

**2. Mostrare lo storico contratti da `user_contract_periods`** (`PerformanceReviewManagement.tsx`)

Nel dialog di modifica profilo, sostituire il campo Textarea "Storico variazioni contrattuali" (riga 706-709) con:
- Il Textarea esistente per note manuali (contract_history)
- Una tabella read-only sotto che mostra i periodi dalla tabella `user_contract_periods` per l'utente selezionato, con colonne: Periodo (date), Tipo contratto, Ore, Costo orario

Al momento dell'apertura del dialog (`openProfileEdit`), caricare i dati da `user_contract_periods` ordinati per `start_date DESC` e mostrarli in una mini-tabella informativa.

### Dettagli tecnici

- Nuovo state: `contractPeriods` per i dati da `user_contract_periods`
- Query in `openProfileEdit`: `supabase.from('user_contract_periods').select('*').eq('user_id', selectedUserId).order('start_date', { ascending: false })`
- La tabella storico è solo in lettura, non modifica i dati dei contratti

