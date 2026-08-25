# Consolidamento Preventivi → Offerte (Opzione B)

## Perché non sono un vero duplicato

| Aspetto | Preventivi (`quotes`) | Offerte (`offers`) |
|---------|----------------------|-------------------|
| Origine | Generato dal **budget approvato** (`budget_id`) | Creata a mano su **cliente**, opzionalmente su progetto |
| Versioni | No | Sì (`offer_versions` + `offer_lines`) |
| Stati | draft / sent / approved / rejected | bozza, in_approvazione, inviata, vista, accettata, rifiutata, scaduta, superata, sostituita |
| Cliente | PDF scaricato a mano | Link pubblico `/offerta/:token`, firma, PDF congelato con hash |
| Fatturazione | Nessuna | `invoice_queue` → Fatture in Cloud, abbonamenti |
| Pagamenti | `quote_payment_splits` (% su modo/termine) | `offer_payment_terms` (maturazione per evento: firma, consegna, fase, ricorrente) |
| Gare | No | Sì (`origin = tender`, CIG, scadenze, allegati) |

I Preventivi sono l'output del budget; le Offerte sono il documento commerciale con firma e fatturazione. Le Offerte sono un superset funzionale: per questo si consolida su di esse.

## Dati verificati in produzione

- 39 preventivi in totale: 34 approvati, 1 inviato, 4 in bozza, 0 rifiutati.
- Tutti e 39 hanno `budget_id`; 34 hanno anche `project_id`.
- 20 righe in `quote_payment_splits`, 18 in `quote_budgets` (preventivi aggregati su più budget).
- Offerte esistenti: 1 offerta, 1 versione (il cantiere è appena partito, quindi il rischio di collisione è minimo).
- `offers` **non ha** una colonna `budget_id`: va aggiunta per conservare il legame budget → offerta.

## Cosa cambia per chi usa il software

- Quando un budget viene approvato non nasce più un "Preventivo": nasce un'**Offerta in bozza**, già pronta per essere inviata al cliente con link pubblico e firma.
- I 39 preventivi storici diventano offerte con lo stesso importo, cliente e stato corrispondente; il numero originale (`PREV-2025-012`) resta visibile come riferimento.
- La voce di menu "Preventivi" viene sostituita da "Offerte"; per i documenti storici resta un filtro "Da budget" nell'elenco offerte.
- I PDF già inviati ai clienti non cambiano: quelli storici restano scaricabili nel formato attuale.

## Sequenza di rilascio

### 1. Preparazione schema

Una migrazione che:
- aggiunge `offers.budget_id` (nullable, FK a `budgets`) e `offers.legacy_quote_number` (text, nullable) per conservare il numero `PREV-...`;
- aggiunge il valore `budget` all'enum `offer_origin` (oggi: `commercial`, `tender`);
- aggiunge `offers.legacy_quote_id` (nullable, FK a `quotes`) per tracciabilità e idempotenza della migrazione.

### 2. Mappatura degli stati e dei pagamenti

- Stati: `draft` → `bozza`, `sent` → `inviata`, `approved` → `accettata`, `rejected` → `rifiutata`.
- Ogni preventivo diventa: 1 `offers` + 1 `offer_versions` (versione 1, corrente) + N `offer_lines` derivate dai `budget_items` con `is_product = true`, più una riga servizio per il residuo (stessa formula usata oggi in `generateQuoteForBudget`).
- `quote_payment_splits` → `offer_payment_terms`: la percentuale resta, il termine `data_documento` diventa evento `firma`, `fine_mese` diventa `data_calendario` calcolata su fine mese. Per i preventivi senza split non si crea nessun piano.
- I 18 `quote_budgets` (preventivi multi-budget) vanno gestiti come offerta unica con righe da tutti i budget collegati: `offers.budget_id` prende il budget principale, gli altri restano riferiti nelle righe.

### 3. Migrazione dei dati storici

Uno script SQL idempotente (salta i preventivi che hanno già `legacy_quote_id` collegato) che crea le offerte a partire dai 39 preventivi, con controllo finale: totale offerte create = 39, somma importi congruente con `quotes.discounted_total`.

### 4. Nuovo flusso di generazione

- `src/lib/generateQuoteForBudget.ts` viene sostituito da `src/lib/generateOfferFromBudget.ts`: stessa logica di calcolo (prodotti + servizio residuo, margine già incluso), ma scrive su `offers` / `offer_versions` / `offer_lines` / `offer_payment_terms` e chiama `set_offer_version_status` per la traccia di creazione.
- `src/hooks/useQuoteGeneration.ts` diventa `useOfferGeneration` con la stessa interfaccia, così i chiamanti cambiano solo l'import.
- I punti che oggi chiamano la generazione preventivo (approvazione budget) puntano al nuovo file.

### 5. Interfaccia

- `Offers.tsx`: filtro per origine (Commerciale / Da budget / Gara) e colonna con il numero storico quando presente.
- `OfferDetail.tsx`: riquadro con budget e progetto di origine, e il numero preventivo storico se c'è.
- `Quotes.tsx` e `QuoteDetail.tsx` restano accessibili in **sola lettura** su `/quotes` per un periodo di transizione (nessuna creazione, nessuna eliminazione), con un avviso in testa e un link all'offerta corrispondente.
- Rimozione della voce "Preventivi" dal menu principale in `AppHeader.tsx`; resta raggiungibile da Impostazioni → Archivio preventivi.

### 6. PDF

`generatePdfQuote` resta per l'archivio storico. Le nuove offerte usano il PDF di `offer-public/pdf.ts`, che è quello che porta hash e certificato di firma. Nessuna unificazione forzata in questa fase.

### 7. Verifiche prima del rilascio

- Migrazione dati lanciata e riconciliata (39/39, importi coincidenti).
- Un budget di prova approvato genera un'offerta in bozza con righe e piano di pagamento corretti.
- Flusso completo: offerta generata → inviata → link pubblico aperto → firmata → tranche comparsa in coda fatture.
- Controllo che nessuna edge function o report legga ancora `quotes` per calcoli attivi (ricerca su `supabase/functions/` e `src/`).

## Rischi

- **Numerazione**: i numeri `PREV-...` sono già stati comunicati ai clienti. Per questo si conservano in `legacy_quote_number` e la tabella `quotes` non viene cancellata.
- **Piani di pagamento**: la mappatura da percentuali a eventi di maturazione è approssimativa per definizione; sui 20 split esistenti va verificata a mano dopo la migrazione.
- **Preventivi multi-budget**: i 18 casi di `quote_budgets` sono la parte più delicata; se la mappatura risulta ambigua, si migrano come offerta a riga singola con l'importo totale e una nota.
- **Rollback**: la migrazione è additiva e `quotes` resta intatta, quindi si torna indietro ripristinando il menu e il vecchio generatore.
