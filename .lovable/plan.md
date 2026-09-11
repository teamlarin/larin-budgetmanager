# Condizioni contrattuali compatte nella pagina pubblica dell'offerta

## Obiettivo
La sezione "Condizioni" della pagina pubblica dell'offerta mostra i 27 articoli tutti aperti e occupa troppo spazio. Renderla compatta a schermo, senza togliere alcun contenuto e senza cambiare il PDF.

## Modifica (un solo file: `src/pages/PublicOffer.tsx`)

- Gli articoli generali diventano un elenco **chiuso di default**:
  - Intestazione visibile: "Condizioni generali di contratto — 27 articoli".
  - Ogni articolo è un elemento apribile singolarmente (`<details>` nativo): si vede solo la riga "Art. N — Titolo", il testo si espande al clic.
  - Un pulsante "Espandi tutto / Comprimi tutto" apre o chiude tutti gli articoli insieme (realizzato sostituendo `<details>` con una lista controllata da stato React).
- Le condizioni specifiche per prodotto (se presenti) restano visibili come oggi, subito sotto.
- La checkbox "dichiaro di aver letto e preso visione delle condizioni" resta obbligatoria e invariata; per facilità, quando il cliente la spunta senza aver aperto nulla, non cambia nulla: la lettura integrale resta a un clic.

## Cosa NON cambia
- PDF dell'offerta e certificato di firma: continuano a riportare tutte le condizioni per esteso.
- Contenuto degli articoli in Impostazioni e nel documento congelato.
- Flusso di firma, doppia conferma, email e webhook.

## Verifica
- `bunx tsgo` e `bun run build`.
- Controllo visivo della pagina pubblica con una bozza d'offerta: pagina corta, articoli apribili, PDF invariato.
