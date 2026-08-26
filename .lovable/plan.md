# Sincronizzazione automatica del listino prodotti da Fatture in Cloud

Oggi il listino `products` si aggiorna solo premendo "Sincronizza listino" in Impostazioni → Integrazioni. Le offerte leggono quel listino, quindi se un prezzo cambia in Fatture in Cloud resta vecchio finché qualcuno non clicca. L'obiettivo è farlo girare da solo ogni notte, lasciando il pulsante manuale dov'è.

## Cosa cambia per chi usa il software

- Ogni notte alle 03:15 (ora italiana) il listino viene riallineato a Fatture in Cloud: prodotti nuovi creati, prezzi e descrizioni aggiornati, il resto invariato.
- In Impostazioni → Integrazioni compare "Ultima sincronizzazione listino" con data/ora ed esito (creati / aggiornati / invariati / saltati), sia dopo un giro automatico sia dopo uno manuale.
- Il pulsante manuale continua a funzionare come prima, per forzare un aggiornamento immediato.
- Nessun prodotto viene mai cancellato automaticamente: la sincronizzazione è solo additiva/aggiornante, come già oggi.

I **servizi** restano fuori: non hanno corrispondenza in Fatture in Cloud e non entrano nelle offerte.

## Dettagli tecnici

1. **`supabase/functions/fic-adapter/index.ts`** — accanto al controllo JWT + ruolo già presente, aggiungere un varco per il cron: se l'header `x-cron-secret` (o `Authorization: Bearer <CRON_SECRET>`) combacia con il secret `CRON_SECRET`, la richiesta è autorizzata come chiamante di sistema (senza `callerId` utente) e limitata alla sola operazione `syncProductCatalog`; qualunque altra operazione via cron viene rifiutata con 403. Il percorso utente resta identico.
2. Al termine di `syncProductCatalog`, scrivere in `app_settings` la chiave `fic_products_last_sync` con `{ at, created, updated, unchanged, skipped, source: 'cron' | 'manual' }` (upsert su `setting_key`, come già fa il sync fornitori con `fic_suppliers_last_sync`).
3. **Cron job** via `run_sql` (contiene URL progetto e secret, quindi non migration): `pg_cron` + `pg_net`, schedule `15 1 * * *` UTC = 03:15 Rome, POST su `/functions/v1/fic-adapter` con header `x-cron-secret` e body `{"operation":"syncProductCatalog","params":{}}`. Nome job: `fic-sync-product-catalog-daily`.
4. **`src/components/FattureInCloudIntegration.tsx`** — nuova query su `app_settings.fic_products_last_sync` e riga informativa sotto il pulsante di sincronizzazione listino, con invalidazione della query dopo il sync manuale.
5. **Verifica**: invocare la funzione una volta con il secret di cron e leggere la risposta e i log; controllare che la riga di stato in Impostazioni si popoli e che un secondo giro riporti tutto in "invariati" (idempotenza).

Il secret `CRON_SECRET` è già in uso per gli altri cron del progetto: se manca in questo ambiente lo aggiungo con il flusso sicuro prima di schedulare.
