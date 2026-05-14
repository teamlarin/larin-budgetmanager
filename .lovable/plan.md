## Problema rilevato

- La sync Jethr raggiunge l’API: dai log risultano 353 richieste presenza/assenza lette e 341 approvate.
- Però nessun profilo TimeTrap ha `jethr_employee_id` valorizzato, quindi la sync non può scrivere assenze/contratti sugli utenti.
- Il dialog “Mappa utenti” dipende ancora dalla lista dipendenti normalizzata; se `/employees/` è vuoto e il fallback non riesce a costruire nomi/email, non mostra utenti importabili.

## Piano di implementazione

1. **Rendere robusta l’estrazione dipendenti dal fallback assenze**
   - Aggiornare `jethr-list-employees` per estrarre sempre un identificativo dipendente dalle richieste `/presence-absence-requests/`, anche quando non trova un oggetto “employee” completo.
   - Usare i `candidatePaths` per prendere ID scalari come `employee_id`, `employee.pk`, `user_id`, ecc.
   - Se nome/email non sono disponibili, creare comunque un dipendente importabile con etichetta leggibile tipo `Dipendente Jethr <id>` e `raw_path`/`source` di debug.

2. **Mostrare subito candidati mappabili nel dialog**
   - Nel frontend, mostrare anche i dipendenti fallback “ID-only” invece di bloccare la UI con “Nessun dipendente”.
   - Nel dropdown visualizzare ID e origine quando mancano nome/email, così puoi abbinarli manualmente.
   - Mantenere l’auto-match quando sono disponibili email/nome, ma non impedire il mapping manuale se c’è solo l’ID.

3. **Allineare la sync agli stessi path usati dal mapping**
   - Centralizzare o replicare in `jethr-sync` la stessa logica di estrazione ID dipendente dalle assenze.
   - Questo evita il caso in cui mappi un ID trovato dal debug, ma la sync cerca un path diverso e quindi non trova l’utente.

4. **Aggiungere diagnostica utile nella UI**
   - Mostrare quanti record Jethr sono stati letti da `/employees/` e da `/presence-absence-requests/`.
   - Mostrare quanti ID dipendente unici sono stati estratti dalle assenze.
   - Se la sync produce 0 assenze ma Jethr ne restituisce molte, mostrare un messaggio esplicito: “mappature mancanti o ID non corrispondenti”.

5. **Validazione post-modifica**
   - Deploy delle edge function modificate.
   - Test diretto della funzione `jethr-list-employees` con sessione autenticata, se disponibile.
   - Verifica nei log che vengano estratti dipendenti fallback e che la sync usi lo stesso ID.