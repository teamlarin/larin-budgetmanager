# Fattura: una riga sola con i prodotti descritti

## Cosa cambia

Oggi la fattura creata da un'offerta genera **una riga per ogni prodotto**, con importo ridotto alla percentuale della tranche. Passiamo alla seconda opzione:

- La fattura torna ad avere **una riga sola** con l'importo della tranche.
- Il **titolo** della riga:
  - se l'offerta ha un solo prodotto → il titolo del prodotto;
  - se ha più prodotti → la causale attuale (es. "Acconto offerta 2026/214, UIL Veneto").
- La **descrizione** della riga elenca i prodotti dell'offerta: per ognuno il titolo e, se presente, la sua descrizione (una voce per riga, nell'ordine dell'offerta).
- Il **collegamento al listino** di Fatture in Cloud resta solo quando l'offerta ha un unico prodotto (una riga sola non può puntare a più articoli di listino).
- L'IVA resta quella della riga di coda; il totale coincide esattamente con l'importo della tranche, senza arrotondamenti da distribuire.
- Per gli abbonamenti/canoni (righe senza offerta collegata) nulla cambia: resta la riga unica con la causale.

Vale sia per l'anteprima che per l'emissione reale.

## Note tecniche

- `supabase/functions/invoice-issue/index.ts`: `buildInvoiceItemsFromOffer` continua a leggere `offer_lines` (`product_name`, `description`, `display_order`, join `products(code, fic_id)`) ma restituisce **un solo** `FicInvoiceItem`:
  - `netPrice = round2(row.amount)`, `qty = 1`, `vatRate = row.vat_rate`;
  - `name` = titolo del prodotto se `lines.length === 1`, altrimenti `row.description`;
  - `description` = elenco `"- <product_name>: <description>"` separato da `\n` (salta la descrizione vuota);
  - `productFicId`/`productCode` solo con `lines.length === 1`.
  - Rimossa la logica di quota (`ratio`) e di assorbimento del delta di arrotondamento.
- `buildInvoiceItems` resta come fallback (nessuna offerta, nessuna riga).
- `fic-adapter` non cambia: `productFicId`/`productCode` sono già supportati.
- Nessuna migrazione. Deploy di `invoice-issue`, poi verifica con l'anteprima su una riga di coda con acconto parziale.
