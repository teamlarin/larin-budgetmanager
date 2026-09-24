# Margine residuo "n.d." nella notifica Slack

## Diagnosi
- Il progetto "Albergo Benito - Sito web" ha i dati per calcolare il margine (approvato, budget attività 6.600 €), quindi il valore non è mancante.
- Il messaggio delle 22:31 è partito senza che il calcolo del margine venisse eseguito: nei registri non c'è nessun calcolo per quel singolo progetto in quel momento. Quindi l'aggiornamento è stato pubblicato da una versione dell'app che non recuperava ancora il margine (versione pubblicata non aggiornata, oppure salvato prima della modifica).

## Interventi
1. Spostare il calcolo del margine dentro la funzione che invia a Slack (lato server, riusando il calcolo condiviso del margine residuo). Così il margine arriva sempre, qualunque versione dell'app pubblichi e anche se il calcolo dal browser fallisce.
2. Il valore passato dal browser resta come riserva, ma prevale quello calcolato dal server.
3. Pubblicare di nuovo la funzione e fare un test con un aggiornamento reale su Albergo Benito, controllando che compaia la percentuale.
4. Ricordare di ripubblicare l'app, perché budget.larin.it usa ancora la versione precedente.

## Dettagli tecnici
- `send-slack-notification`: accettare `project_id`; per `progress_update` e `project_completed` chiamare `getProjectResidualMargin` da `_shared/residual-margin.ts` con client service role.
- `progressUpdates.ts`: passare `project_id` nel payload.
