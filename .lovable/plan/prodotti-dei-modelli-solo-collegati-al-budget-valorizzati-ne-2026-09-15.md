# Prodotti dei modelli: solo collegati al budget, valorizzati nell'offerta

## Cosa cambia per chi usa il software

- Quando applichi un **modello di budget** dentro un budget, il prodotto collegato al modello **non viene più aggiunto come voce** dell'elenco: non compare tra le righe e non altera costo totale, ore o ripartizione per categoria.
- Sull'**intestazione della sezione del modello** compare un badge con il nome (e codice) del prodotto collegato, così si vede a colpo d'occhio che quel blocco di attività verrà fatturato con quel prodotto.
- All'**approvazione del budget**, l'offerta in bozza contiene una riga per ogni prodotto collegato, con **l'importo che deriva dalle attività di quel modello** presenti nel budget (margine incluso), non dal prezzo di listino. Titolo e descrizione arrivano dal prodotto e restano modificabili in offerta.
- Anche senza modello, aggiungere **attività personalizzate** richiede la selezione **obbligatoria di un prodotto**: resta solo collegato (badge sull'intestazione del gruppo, senza importi che alterano il totale) e nell'offerta la quota d'importo di quelle attività diventa la riga di quel prodotto, al posto della generica "Servizi e attività". Serve una nuova colonna `linked_product_id` su `budget_items` per le righe attività, e nel form la selezione del prodotto diventa obbligatoria quando non c'è un modello. I prodotti aggiunti a mano come voce del budget continuano a funzionare come oggi.
- Nessun budget esistente viene modificato: le righe prodotto già presenti restano dove sono.

## Come si calcola l'importo

Partendo dal totale offerto del budget (che già include il margine):

1. Si sottraggono le eventuali righe prodotto inserite a mano → resta il valore attribuibile alle attività.
2. Questo valore viene ripartito tra i modelli in proporzione al costo delle loro attività.
3. La quota di ogni modello diventa l'importo della riga del prodotto collegato.
4. Le attività senza modello formano la riga "Servizi e attività"; l'ultima riga assorbe la differenza di arrotondamento, così la somma coincide al centesimo con il totale del budget.

## Dettagli tecnici

**`src/components/BudgetItemForm.tsx`**
- Rimuovere il blocco `productItems` in `handleSubmit` (righe ~370-392): applicando un modello si inseriscono solo le attività, con `sourceTemplateId` valorizzato. `templateProductLinks` resta caricato solo se serve per la visualizzazione, altrimenti si rimuove il fetch.

**`src/components/BudgetManager.tsx`**
- Nuova query `budget-template-linked-products` su `budget_template_products` (filtrata su `referencedTemplateIds`) con join `products (id, name, code)`.
- `ItemGroup` estesa con `linkedProducts`; nell'intestazione del gruppo `tpl:` render di un badge per prodotto collegato accanto al badge disciplina.

**`src/lib/generateOfferFromBudget.ts`**
- Oltre alle righe `is_product` del budget, leggere i `source_template_id` distinti delle voci attività, caricare `budget_template_products` + `products` (`name`, `description`, `revenue_category`, `code`) per quei modelli.
- Calcolo: `productsTotal` (righe prodotto manuali) → `activitiesValue = offeredTotal - productsTotal`; per ogni modello con prodotto collegato, `amount = activitiesValue * costoAttivitàModello / costoAttivitàTotale`; residuo → riga `Servizi e attività`; correzione di arrotondamento sull'ultima riga.
- Le righe generate mantengono `product_id` (riferimento statistico), `product_name`, `description`, `revenue_category` dal listino, `quantity = 1`, `vat_rate` 22 di default.

**Nessuna migrazione**: il collegamento è già dato da `budget_items.source_template_id` + `budget_template_products`.

## Verifica

- Applicare in un budget un modello con prodotto collegato: nessuna riga prodotto in elenco, badge presente, totale invariato.
- Approvare il budget: offerta in bozza con la riga del prodotto all'importo pari alla quota del modello, e somma delle righe uguale al totale del budget.
- Budget con più modelli + attività personalizzate + un prodotto aggiunto a mano: verificare la ripartizione e l'assenza di scostamenti di centesimi.
