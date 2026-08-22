# Integrazione Offerte, Fatture, Abbonamenti, Gare e Cruscotto vendite

Porto in questo progetto (produzione `dmwyqyqaseyuybqfawvk`) il cantiere sviluppato sul branch `feat/offers-foundation` del fork `marcodarin/larin-budgetmanager`, seguendo il piano di rilascio.

Verifiche fatte prima di scrivere il piano:
- Il branch è pubblico e leggibile: 26 commit avanti, 74 file (52 nuovi, 6 modificati condivisi, 16 migration, 2 file di test SQL, 5 file e2e).
- In produzione non esiste nessuna tabella `offers*`, `invoice*`, `subscription*`, `tender*`: le migration sono tutte da applicare.
- Il ruolo `finance` usato dai nuovi menu esiste già nell'enum `app_role`.
- Dei file condivisi, dal 13/08 in questo progetto è cambiato solo `AppHeader.tsx` (pulsante rapido task): tutti gli altri sono identici alla base del branch, quindi l'unica fusione manuale a mano è la navigazione.

## Cosa vedrà l'utente

- **Offerte**: elenco e scheda offerta con versioni, righe, stati, piano di pagamento, soglia di approvazione, link pubblico per il cliente con firma e PDF congelato con hash.
- **Pagina pubblica offerta** su `/offerta/:token`, accessibile senza account (anche da telefono).
- **Fatture**: coda di fatturazione con residuo per offerta ed emissione verso Fatture in Cloud (con modalità di prova che costruisce il documento senza inviarlo).
- **Abbonamenti**: canone storicizzato, periodi, disdetta.
- **Gare**: origine, scadenze, allegati, firma facoltativa.
- **Cruscotto vendite**: venduto, conversione, mix di ricavo, top prodotti, venduto per commerciale.
- Voci di menu nuove filtrate per ruolo (Offerte: admin/team leader; Fatture: admin/finance; Abbonamenti e Cruscotto: admin/finance/account; Gare: admin/account).

## Sequenza di rilascio

1. **Backup del database di produzione** dalla dashboard Supabase (Database → Backups), verificato e datato: prima di tutto il resto. Questa parte va fatta manualmente prima che io proceda.
2. **Le 16 migration, nell'ordine dei nomi file**, applicate una per una con lo strumento di migrazione di Lovable (che chiede approvazione), non da riga di comando: `20260813120000` → `20260814150000`. Nota sui due punti non additivi: la 7 (`20260814040000`) revoca e riconcede i privilegi sulle tabelle offerte — innocua qui perché quelle tabelle nascono in questo stesso rilascio; la 6 (`20260814030000`) fa backfill di `offers.current_version_id`, che in produzione non trova righe. La 12 installa `btree_gist`.
3. **Secret delle edge function**: aggiungo con il flusso sicuro `FIC_MANUAL_TOKEN`, `FIC_COMPANY_ID` (22474), `MANDRILL_API_KEY`, `SITE_URL` (`https://budget.larin.it`), `OFFER_SENDER_EMAIL`, `OFFER_SENDER_NAME`. Verifico prima quali esistono già; per quelli mancanti chiedo i valori con il prompt sicuro dei secret (mai in chat).
4. **Edge function**: nuove `offer-public` (con `verify_jwt = false` in `supabase/config.toml`, la apre il cliente), `offer-send-to-client`, `invoice-issue`, `fic-adapter` e lo shared `_shared/fic-token.ts`; modificata `fatture-in-cloud-oauth` (sei scope). Il deploy avviene automaticamente da Lovable.
5. **Codice applicativo**: 52 file nuovi (pagine `Offers`, `OfferDetail`, `PublicOffer`, `InvoiceQueue`, `Subscriptions`, `Tenders`, `SalesDashboard` più i componenti in `src/components/offers|sales|subscriptions|tenders|invoices`), le rotte in `App.tsx`, `formatCurrency` in `src/lib/utils.ts`, l'aggiornamento di `FattureInCloudIntegration.tsx` e la fusione delle nuove voci in `AppHeader.tsx` mantenendo il pulsante rapido task già presente.
6. **Test SQL degli invarianti** copiati in `supabase/tests/` e lanciati contro la produzione: attesi 43/43 (offerte) e 16/16 (fatture). Girano in transazione con ROLLBACK.
7. **Verifiche funzionali**: import listino dall'integrazione (attesi 70 prodotti, 25 ricorrenti, idempotente al secondo giro); un'offerta completa su cliente di prova (comporre → inviare → aprire il link → firmare, con certificato e hash nel PDF); la tranche in coda comparsa da sé alla firma.

## Scelte tecniche

- `src/integrations/supabase/client.ts`: **non** porto l'override da variabili d'ambiente del branch. Qui il progetto è la produzione e Lovable rigenera quel file; tenerlo standard evita che un `.env` locale punti l'app altrove.
- `src/integrations/supabase/types.ts` non lo scrivo a mano: si rigenera dallo schema dopo le migration.
- `supabase/functions/mcp/index.ts` non è nel diff del branch e resta invariato: nessun rischio che l'MCP punti allo staging.
- I file `e2e/` del branch (Playwright su staging) li porto solo se serve; per default li lascio fuori dal rilascio in produzione.
- `fatture-in-cloud-oauth` viene aggiornata comunque: con `FIC_MANUAL_TOKEN` presente l'adattatore usa il token manuale e il percorso OAuth resta di riserva.

## Da tenere presente

- La prima emissione verso Fatture in Cloud crea un documento vero: la faccio girare in modalità di prova e lascio a Marco il primo invio reale, su una riga di importo piccolo.
- L'invio email al cliente non è mai stato collaudato (Mandrill assente sullo staging): il primo invio vero è anche il primo test.
- Durante il rilascio conviene non avere altri deploy in corso.
- Il ritorno indietro: le migration sono additive, quindi basta non usare le schermate nuove; per un problema grosso si ripristina il backup.
