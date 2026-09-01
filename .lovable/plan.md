# Solo prodotti: i servizi escono di scena, i preventivi anche

Da qui in avanti il catalogo è uno solo: i prodotti allineati a Fatture in Cloud. I servizi non si vedono e non si usano più da nessuna parte, e il budget non genera più preventivi perché i prodotti collegati arrivano già nell'offerta in bozza.

## Cosa cambia per chi usa il software

- **Impostazioni**: scompare la scheda "Servizi". Resta solo "Prodotti", che si aggiorna da Fatture in Cloud (sync notturno + pulsante manuale).
- **Budget**: scompare il riquadro "Servizi collegati" e il pulsante "Genera Preventivo". Restano i prodotti collegati come voci del budget, che finiscono nelle righe dell'offerta in bozza generata all'approvazione.
- **Nuovo progetto**: al posto della selezione obbligatoria di servizi c'è una selezione **facoltativa di prodotti** dal listino. Se ne scegli qualcuno, entrano nel budget come voci prodotto; se non scegli nulla, procedi senza bloccarti.
- **Preventivi**: le pagine residue (elenco e dettaglio preventivo, già fuori dal menu) e il PDF preventivo vengono rimossi. Il flusso documentale è solo Offerte, con il suo PDF e il link firma.
- Nessun dato viene cancellato: i servizi e i preventivi storici restano nel database come archivio consultabile solo dal database, non dall'app.

## Dettagli tecnici

**Servizi — rimozione dall'interfaccia (dati conservati)**
- Eliminare `src/components/BudgetLinkedServices.tsx`, `ServiceManagement.tsx`, `ServiceFormDialog.tsx` e il loro uso in `src/pages/ProjectBudget.tsx` (riga ~677) e `src/pages/Settings.tsx` (tab `services`).
- `src/components/BudgetManager.tsx`: togliere la query `budget-services`, lo stato `editingServices` e tutto il blocco di modifica servizi/margine servizi.
- `src/components/CreateProjectDialog.tsx`: sostituire `service_ids` (oggi `.min(1)`) con `product_ids` opzionale, fetch da `products`, e all'invio inserire i prodotti scelti come `budget_items` con `is_product = true`, `product_id`, prezzo dal listino — non più `budget_services`.
- Nessuna migration: `services`, `budget_services`, `project_services`, `service_payment_splits` restano in piedi con i loro dati; l'app smette semplicemente di leggerle e scriverle. La voce di permesso `can_manage_services` resta nello schema ma non viene più letta dall'interfaccia.

**Preventivi — rimozione**
- Eliminare `src/pages/Quotes.tsx`, `src/pages/QuoteDetail.tsx`, `src/components/QuoteStatusSelector.tsx`, `src/components/QuotePaymentSplitsSection.tsx`, `src/lib/generatePdfQuote.ts` e il dashboard `AccountBudgetQuoteDashboard.tsx` se il suo unico contenuto sono i preventivi (altrimenti solo la parte preventivi).
- `src/App.tsx`: rimuovere le rotte `/quotes` e `/quotes/:quoteId` e i relativi lazy import.
- `src/components/BudgetManager.tsx`: rimuovere il pulsante "Genera Preventivo" e la funzione che crea la riga in `quotes`, i `quote_budgets` e i `quote_payment_splits`.
- Pulire i riferimenti residui a preventivi nei link/dashboard (`ProjectCard.tsx`, `AccountDashboard.tsx`, docs in `src/components/docs/`) e nella documentazione interna.
- **Da non toccare**: il campo `quote_number` su budget e progetti resta, perché serve per la numerazione e per il nome delle cartelle Drive. Le tabelle `quotes`/`quote_budgets` restano nel database come archivio.

**Verifica**
- Build + typecheck pulito, nessun import rotto verso i file eliminati.
- Creazione di un nuovo progetto senza prodotti e con prodotti; approvazione budget con prodotti collegati e controllo che le righe prodotto compaiano nell'offerta in bozza.
