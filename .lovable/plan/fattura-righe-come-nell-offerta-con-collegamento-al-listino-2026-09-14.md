# Fattura: righe come nell'offerta, con collegamento al listino

## Cosa cambia

Oggi la fattura esce con una sola riga generica ("Acconto offerta 2026/214, UIL Veneto") e l'importo della tranche. D'ora in poi la fattura riporta **i prodotti dell'offerta accettata**, uno per riga:

- **Titolo** = titolo della riga d'offerta (quello modificabile in offerta).
- **Descrizione** = descrizione della riga d'offerta.
- **Importo** = quota della riga corrispondente alla percentuale fatturata. Su un acconto del 30%, ogni prodotto compare al 30% del suo valore; il totale della fattura resta esattamente l'importo della tranche.
- **Collegamento al listino**: se il prodotto esiste già in Fatture in Cloud (stesso codice/collegamento salvato), la riga viene agganciata a quel prodotto, così le statistiche di Fatture in Cloud lo riconoscono. Se il collegamento manca, la riga resta libera con titolo e descrizione.
- L'oggetto del documento continua a dire di cosa si tratta ("Acconto offerta 2026/214, UIL Veneto"), così resta chiaro che non è il saldo.

Righe d'offerta fuori listino (servizi e attività generate dal budget) compaiono comunque con titolo e descrizione, semplicemente senza collegamento al listino.

Se una riga di coda non discende da un'offerta con righe (per esempio un canone di abbonamento), la fattura resta come oggi: riga unica con la causale.

## Dettagli tecnici

`supabase/functions/invoice-issue/index.ts`:
- Nuova funzione `buildInvoiceItemsFromOffer(supabase, row)`: legge `offer_lines` di `invoice_queue.offer_version_id` (`product_name`, `description`, `quantity`, `unit_list_price`, `discount_percentage`, `line_total`, `vat_rate`, `product_id`) in `display_order`, con join a `products (code, fic_id)`.
- Quota: `ratio = row.amount / somma(line_total)`. Per ogni riga `netPrice = round2(line_total * ratio)`, `qty = 1`, `discount` non riproposto (già scontato nel `line_total`). L'ultima riga assorbe la differenza di arrotondamento perché la somma coincida al centesimo con `row.amount`.
- IVA: si usa `vat_rate` della riga d'offerta; `invoice_queue.vat_rate` resta fallback quando la riga non lo ha.
- Collegamento listino: si passano `productFicId` (`products.fic_id`) e `productCode` (`products.code`) quando presenti.
- Fallback all'attuale `buildInvoiceItems(row)` se `offer_version_id` è nullo, se non ci sono righe o se la somma dei `line_total` è 0.
- `subject` del documento = `row.description` (la causale di `build_invoice_description`).
- Stesso percorso usato sia in `dry_run` sia nell'emissione reale, così l'anteprima mostra esattamente le righe che verranno create.

`supabase/functions/fic-adapter/index.ts`:
- `InvoiceItemSchema`: nuovi campi opzionali `productFicId: number` e `productCode: string`.
- `opCreateInvoice`: in `items_list` aggiunge `product_id: item.productFicId` e `code: item.productCode` quando presenti (campi supportati da `IssuedDocumentItemsListItem`).

Nessuna migrazione: `offer_lines.product_name` e `products.fic_id`/`code` esistono già.

## Verifica

Emissione in modalità di prova (`dry_run`) su una tranche dell'offerta 2026/214: controllo che le righe siano quelle dell'offerta, che la somma netta coincida con l'importo della tranche e che i prodotti collegati portino `product_id`. Poi lascio a te l'emissione reale.
