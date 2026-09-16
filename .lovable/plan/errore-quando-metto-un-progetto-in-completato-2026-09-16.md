# Errore quando metto un progetto in "Completato"

Sul progetto "MotorK - Sito web Regie Auto" il passaggio di stato a Completato mostra "Errore durante l'aggiornamento" e lo stato resta "Aperto" (verificato: il progetto è ancora `aperto`).

La causa precisa non è ancora confermata: il messaggio mostrato a schermo non riporta l'errore reale restituito dal database, e nei log del preview non è rimasta traccia della chiamata fallita. Quindi il primo passo è far emergere l'errore vero, poi correggerlo.

## Cosa ho già verificato

- Il progetto non ha task aperte (0 task in totale), quindi non è la chiusura automatica delle task a fallire per un problema di stati.
- Il progetto ha 4 attività previste, tutte con una persona assegnata: sono queste che la chiusura automatica prova a marcare come completate.
- Il salvataggio del webhook verso Make non può bloccare il salvataggio (gli errori vengono ignorati).
- Il tuo utente è admin e ha i permessi per cambiare stato.

## Cosa faccio

1. **Mostro l'errore reale**: nella scheda progetto il messaggio di errore includerà il testo restituito dal database invece del generico "Errore durante l'aggiornamento", così ogni problema futuro è immediatamente leggibile.
2. **Riproduco il passaggio a Completato** su questo progetto in un test isolato che viene annullato, per leggere l'errore esatto.
3. **Correggo la causa** individuata. L'ipotesi più probabile è la chiusura automatica di attività e task introdotta di recente: se il blocco riguarda l'inserimento dei completamenti delle attività previste, lo rendo tollerante (salta le righe problematiche senza far fallire il cambio di stato) mantenendo il comportamento voluto: task e attività aperte vengono chiuse insieme al progetto.
4. **Verifico** portando davvero il progetto a Completato e controllando che task e attività risultino chiuse, che il webhook Make parta e che la notifica Slack venga inviata.

## Dettagli tecnici

- File coinvolti: `src/pages/ProjectCanvas.tsx` (messaggio d'errore con `error.message`) e, se confermato, la funzione trigger `public.complete_open_items_on_project_completion()` via migrazione.
- Riproduzione: `UPDATE public.projects SET project_status='completato' WHERE id='cb319cd6-117f-4377-a485-7d67cd9f4877'` dentro una transazione con `ROLLBACK`, per catturare `SQLSTATE`/messaggio senza modificare i dati.
- Se il problema è nella funzione trigger, la riscrivo con la chiusura task e l'inserimento in `user_activity_completions` protetti da un blocco `EXCEPTION WHEN OTHERS THEN RAISE WARNING`, così il cambio stato del progetto non viene mai annullato da un effetto collaterale.
- Nessun dato storico viene modificato oltre al progetto che stai chiudendo.
