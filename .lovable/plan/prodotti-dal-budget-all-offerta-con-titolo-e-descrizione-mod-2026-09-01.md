# Prodotti: dal budget all'offerta, con titolo e descrizione modificabili

## Obiettivi
1. Nel budget si selezionano i prodotti (già possibile) e i modelli di budget possono portare con sé prodotti collegati, che finiscono nel budget e poi nell'offerta.
2. Ogni riga d'offerta nasce sempre da un prodotto del listino: nome e descrizione sono modificabili, ma il riferimento per le statistiche resta il prodotto scelto.
3. La categoria di ricavo è una selezione (non testo libero), precompilata dal prodotto.
4. La selezione prodotto in "Aggiungi riga" ha una ricerca.

## Cosa cambia per l'utente

### Modelli di budget con prodotti collegati
- Nella gestione modelli, al posto del vecchio collegamento "Servizi" (superato) si collegano **Prodotti** del listino, con quantità.
- Quando un modello viene applicato in un budget, oltre alle attività vengono create anche le righe prodotto (prezzo dal listino, modificabile come oggi).

### Offerta
- La tabella "Composizione offerta" avrà due colonne distinte: **Titolo** e **Descrizione**, entrambe modificabili in bozza. Il titolo è precompilato con il nome del prodotto, la descrizione con quella del listino.
- Ogni riga mostra un riferimento al prodotto d'origine (codice), non modificabile: è quello che alimenta il cruscotto vendite, anche se titolo/descrizione vengono riscritti.
- **Categoria di ricavo**: menu a tendina con le categorie di ricavo esistenti nel listino, preselezionata dal prodotto.
- Le righe "Servizi e attività" generate dal budget restano senza prodotto (fuori listino) come oggi; per aggiungere righe nuove serve sempre scegliere un prodotto.
- Il dialog "Aggiungi riga" diventa un selettore con **ricerca** (per nome, codice e categoria), che mostra codice, natura e prezzo netto e precompila prezzo, IVA, titolo e descrizione.

## Dettagli tecnici

**Migrazione database**
- `offer_lines`: nuova colonna `product_name text` (titolo riga). Backfill: `product_name = description`, `description = products.description` per le righe con `product_id`; per le righe fuori listino `product_name = description` e descrizione vuota.
- Nuova tabella `budget_template_products` (`budget_template_id`, `product_id`, `quantity`, `display_order`) con GRANT, RLS allineata a `budget_templates`.
- Viste vendite: `sales_lines` usa già `COALESCE(p.name, l.description)`, aggiornata a usare `product_name` come fallback — le statistiche continuano a raggrupparsi per `product_id`/codice listino.

**Frontend**
- `src/pages/OfferDetail.tsx`: colonna Titolo + Descrizione, badge codice prodotto, `Select` per `revenue_category` (opzioni = categorie distinte dei prodotti + valore corrente), combobox `Command` con ricerca nel dialog "Aggiungi riga", insert/update estesi a `product_name`.
- `src/pages/PublicOffer.tsx` e `supabase/functions/offer-public/pdf.ts`: mostrano titolo in evidenza e descrizione sotto.
- `src/lib/generateOfferFromBudget.ts`: valorizza `product_name` (nome prodotto o nome voce) e `description` (descrizione del prodotto), oltre a `revenue_category` dal prodotto.
- `src/components/BudgetTemplateManagement.tsx`: sezione "Prodotti collegati" basata sulla nuova tabella al posto della query su `services`.
- `src/components/BudgetItemForm.tsx`: quando si applica un modello, aggiunge anche le voci prodotto collegate (`isProduct`, `productId`, prezzo netto).

## Verifica
- Modello con prodotti → applicato a un budget → righe prodotto presenti; approvazione budget → offerta in bozza con titolo, descrizione, categoria di ricavo.
- Modifica titolo/descrizione in offerta accettata → cruscotto continua a contare il prodotto originale.
- Ricerca prodotto nel dialog e categoria di ricavo come tendina.
