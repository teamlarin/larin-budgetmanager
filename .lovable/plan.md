# Attività non selezionabili in "Nuova attività manuale" per Marialivia Bassan

## Cosa ho verificato

Ho controllato i dati e i permessi lato database: il profilo di Marialivia è approvato, è inserita nel team dei progetti, e **tutti** i suoi progetti aperti hanno attività (per esempio "Management & pianificazione 2026" ne ha 4 oltre alle ore importate). Le regole di accesso alle attività consentono la lettura a qualsiasi utente approvato.

Quindi il blocco non è nei dati né nei permessi: la causa è nel comportamento dell'app durante la lettura (sessione, richiesta fallita o versione pubblicata non aggiornata). Non l'ho ancora confermata, quindi il primo passo del piano è riprodurre il caso con il suo account.

## Come procedo

1. **Riproduzione con il suo account**: apro il calendario come Marialivia, seleziono un progetto e leggo esattamente cosa risponde la richiesta delle attività (elenco vuoto, errore o richiesta bloccata). Il messaggio d'errore viene già registrato, quindi si vedrà la causa reale.
2. **Correzione della causa emersa**, che potrà essere: una richiesta rifiutata da correggere, oppure la versione pubblicata dell'app non aggiornata (in quel caso basta pubblicare).
3. **Rete di sicurezza nel campo Attività**, indipendentemente dalla causa:
   - il messaggio "Questo progetto non ha attività" compare solo quando la lettura è andata a buon fine e non ci sono davvero attività;
   - durante il caricamento compare lo stato di attesa; se la lettura fallisce compare un avviso con il pulsante **Riprova**;
   - vengono incluse anche le righe con categoria o nome vuoti, che oggi potrebbero essere scartate per errore.
4. **Verifica finale** ripetendo la creazione di un'attività manuale con il suo account su due progetti diversi.

## Note tecniche

- Riproduzione via Playwright con sessione dell'utente `6c2ce3ee-61d0-4371-bf17-4fa3aac5f182`, lettura di console e richieste di rete su `['project-all-activities', projectId]` in `src/components/CreateManualActivityDialog.tsx`.
- Punti già confermati: policy `Only approved users can manage budget items` (ALL, `is_approved_user`) e grant `authenticated` presenti su `budget_items`; `profiles.approved = true`; 19 progetti aperti accessibili, tutti con attività non-prodotto.
- Nessuna modifica prevista al database, alle RLS o ai permessi; eventuali interventi restano nel dialog del calendario.
