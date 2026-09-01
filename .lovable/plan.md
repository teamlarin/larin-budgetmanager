# Titolo offerta e numero modificabile

## Obiettivo
1. Ogni offerta ha un **titolo** visibile in elenco e nel dettaglio, prefillato dal nome del budget quando l'offerta nasce da un budget approvato, e modificabile a mano.
2. Il **numero progressivo** dell'offerta è modificabile manualmente (l'anno resta fisso e non editabile).

## Cosa cambia per l'utente

### Titolo
- Nuova colonna "Titolo" nella tabella Offerte, subito dopo il numero; se manca, viene mostrato un trattino.
- La ricerca in alto trova le offerte anche per titolo.
- Nel dettaglio offerta il titolo compare come intestazione principale, con il numero come sottotitolo, ed è modificabile con un click (matita accanto al titolo).
- Le offerte generate dall'approvazione di un budget nascono con il titolo del budget già compilato. Le offerte create a mano possono avere un titolo indicato subito nella finestra "Nuova offerta" (facoltativo).

### Numero
- Nel dettaglio offerta, accanto a "N° 12/2026", un pulsante di modifica apre un piccolo campo per inserire un nuovo progressivo (solo numeri interi positivi).
- L'anno non è modificabile.
- Se il numero è già usato per lo stesso anno, appare un messaggio chiaro ("Numero già assegnato a un'altra offerta del 2026") e nulla viene salvato.
- Il numero automatico dei nuovi documenti continua a seguire il contatore esistente: una modifica manuale non lo fa arretrare.

### Chi può modificarli
Titolo e numero sono modificabili da chi già può gestire l'offerta (admin, account, finance e chi l'ha creata), in qualsiasi stato dell'offerta. Gli altri ruoli li vedono in sola lettura.

## Dettagli tecnici

**Migrazione** (`public.offers`):
- `ADD COLUMN title text` (nullable), con commento descrittivo.
- Backfill: per le offerte con `budget_id` valorizzato, `title = budgets.name`.
- Nessun cambio ai vincoli: resta `UNIQUE (year, number)`, che garantisce la protezione contro i duplicati anche in caso di modifica manuale. Le policy attuali (`can_manage_offer(id)` su UPDATE) già coprono i due nuovi aggiornamenti, quindi non servono nuove policy né GRANT aggiuntivi.

**Frontend**:
- `src/pages/Offers.tsx`: aggiungere `title` a `OfferListRow`, alla `select`, alla colonna tabella e al filtro di ricerca.
- `src/pages/OfferDetail.tsx`: aggiungere `title` alla query e al tipo `OfferDetailRow`; header con titolo editabile inline e numero editabile inline; entrambi salvati con `supabase.from('offers').update({...}).eq('id', offerId)` seguito da `refetchOffer()`; gestione dell'errore Postgres `23505` (unique violation) con toast dedicato; entrambe le azioni condizionate a `canManage`.
- `src/components/CreateOfferDialog.tsx`: campo facoltativo "Titolo offerta" incluso nell'insert.
- `src/lib/generateOfferFromBudget.ts`: passare `title: budgetData.name` nell'insert dell'offerta.
- `src/components/tenders/*`: se la creazione gara passa dalla stessa insert, valorizzare `title` con `tender_subject` quando disponibile.

**Verifica**: build/typecheck puliti; modifica titolo e numero su un'offerta esistente; tentativo di numero duplicato che mostra l'errore; nuova offerta da budget approvato con titolo prefillato.
