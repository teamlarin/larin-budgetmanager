# Rimozione delle sottoattività

Eliminare il concetto di sottoattività dalle attività di budget e progetto, ora sostituito dalle Task. Le sottoattività esistenti saranno convertite in attività normali autonome, senza cancellare dati o storico.

## Risultato per l’utente

- Nella scheda progetto non compariranno più il pulsante **Sotto-attività**, i contatori, l’espansione e le righe annidate.
- Tutte le attività saranno mostrate allo stesso livello e continueranno a poter essere modificate, assegnate, pianificate e collegate alle Task.
- L’importazione da un altro progetto copierà una lista piatta di attività, senza gerarchie.
- La creazione e la modifica del budget non proporranno più opzioni o testi relativi alle sottoattività.

## Conservazione dei dati

Sono presenti 100 sottoattività distribuite su 26 progetti, con 292,5 ore previste. Sono collegate a 1.700 registrazioni ore e 2 Task.

La migrazione le convertirà in attività normali impostando la relazione gerarchica a vuoto prima di rimuovere il campo. Gli identificativi delle attività non cambieranno: registrazioni ore, Task, assegnazioni e storico resteranno collegati alle stesse righe.

## Interventi

1. **Migrazione dati e struttura**
   - Convertire tutte le sottoattività esistenti in attività autonome.
   - Rimuovere dalla tabella delle attività il campo gerarchico e il relativo indice/vincolo, se presenti.
   - Non modificare i campi di ricorrenza di Task e calendario, che sono indipendenti.

2. **Scheda progetto**
   - Rimuovere creazione, raggruppamento, espansione e resa grafica delle sottoattività.
   - Conteggiare e sommare tutte le attività direttamente, senza filtri tra principali e secondarie.
   - Mantenere invariate modifica, cancellazione, assegnazione, ore, costi e progresso.

3. **Budget e copia dei dati**
   - Rimuovere il parametro e il titolo “Nuova Sotto-attività” dal modulo budget.
   - Semplificare duplicazione budget e creazione progetto da offerta: tutte le attività saranno copiate in un solo passaggio.
   - Aggiornare l’importazione da progetto per selezionare e copiare ogni attività autonomamente.

4. **Calendario e selettori**
   - Eliminare rientri e logiche gerarchiche nei selettori delle attività.
   - Conservare la selezione delle stesse attività grazie agli identificativi invariati.

5. **Verifiche**
   - Controllare che nessuna attività, registrazione ore, Task o assegnazione venga persa.
   - Verificare conteggi, ore previste, costi e marginalità dopo l’appiattimento.
   - Testare creazione progetto da offerta, duplicazione budget, importazione attività, calendario e scheda progetto.
   - Eseguire test automatici e controllo finale dell’app.

## Nota tecnica

La rimozione riguarda esclusivamente `budget_items.parent_id`. I campi `recurrence_parent_id` usati per le ricorrenze di Task e calendario restano intatti.
