# Consolidamento Offerte vs Preventivi

## Stato attuale: non sono un duplicato puro

| Aspetto | Preventivi (`quotes`) | Offerte (`offers`) |
|---------|----------------------|-------------------|
| **Origine dati** | Generato automaticamente da un **budget approvato** (`budget_id`, `project_id`) | Creata manualmente su **cliente** (`client_id`) e opzionalmente progetto (`project_id`) |
| **Versionamento** | No: unico documento con stato | Sì: `offer_versions` + `offer_lines`, revisioni multiple |
| **Stati** | `draft`, `sent`, `approved`, `rejected` | `bozza`, `in_approvazione`, `inviata`, `vista`, `accettata`, `rifiutata`, `scaduta`, `superata`, `sostituita` |
| **Interazione cliente** | PDF statico scaricato | Link pubblico (`/offerta/:token`), firma cliente, PDF congelato con hash/certificato |
| **Fatturazione** | Nessuna integrazione diretta | Coda fatture (`invoice_queue`), emissione verso Fatture in Cloud, abbonamenti |
| **Gare** | No | Sì: origine `tender`, CIG, scadenze, allegati |
| **Piano di pagamento** | `quote_payment_splits` (percentuali su modi/termini) | `offer_payment_terms` (scadenze legate a eventi: firma, consegna, pubblicazione fase, ricorrente) |
| **Numerazione** | `PREV-YYYY-NNN` | `OFF-YYYY/NNN` |

**Conclusione**: i Preventivi sono un **output del budget** (documento interno/commerciale derivato); le Offerte sono un **oggetto commerciale autonomo** con ciclo di vita, firma e fatturazione.

## Opzioni di consolidamento

### Opzione A — Mantenere entrambe con confini chiari (raccomandata a breve termine)

- I **Preventivi** restano il documento generato dal budget, usato per approvare la spesa interna e dare al cliente una prima proposta.
- Le **Offerte** diventano il documento commerciale negoziato, firmato e fatturato.
- Flusso consigliato: budget → preventivo → se il cliente richiede varianti/negoziazione, si crea un'**offerta** collegata allo stesso progetto/cliente.
- Interventi minimi: rinominare le voci di menu (es. "Preventivi" → "Preventivi da budget", "Offerte" → "Offerte commerciali") e aggiungere un pulsante "Crea offerta da questo preventivo" in `QuoteDetail.tsx`.

### Opzione B — Sostituire i Preventivi con le Offerte (consolidamento completo)

- Quando un budget viene approvato, invece di generare un `quotes`, si genera un'**offerta in bozza** (versione 1) con le righe derivate da `budget_items`.
- `quote_payment_splits` viene convertito in `offer_payment_terms`.
- I preventivi storici vengono migrati in offerte (stato `accettata` se avevano `approved`, `rifiutata` se `rejected`, etc.).
- La sezione **Preventivi** viene rimossa o resa read-only; i PDF esistenti restano accessibili.
- Edge function `generateQuoteForBudget` viene sostituita da `generateOfferFromBudget`.

## Piano raccomandato: Opzione B in due fasi

### Fase 1 — Allineamento e preparazione (1-2 giorni)

1. **Audit dati**: contare quanti preventivi esistono, quanti hanno un progetto collegato, quanti sono `approved`/`rejected`/`draft`.
2. **Mappa campi** tra `quotes`/`quote_payment_splits` e `offers`/`offer_versions`/`offer_lines`/`offer_payment_terms`.
3. **Verifica vincoli**: le offerte non hanno `budget_id`; decidere se aggiungerlo o se usare `project_id` come ponte.
4. **Backup**: snapshot del database prima di qualsiasi migrazione.

### Fase 2 — Sviluppo (3-5 giorni)

1. **Schema**
   - Aggiungere `budget_id` a `offers` (nullable) per mantenere il legame budget→offerta.
   - Aggiungere `origin = 'budget'` all'enum `offer_origin` (valori attuali: `commercial`, `tender`).
   - Creare funzione di migrazione SQL che trasforma ogni `quotes` + `quote_payment_splits` in `offers` + `offer_versions` + `offer_lines` + `offer_payment_terms`.
2. **Flusso budget**
   - Modificare `generateQuoteForBudget.ts` (o il trigger che lo chiama) per creare un'offerta in bozza anziché un preventivo.
   - Aggiornare `BudgetDetail.tsx` / `ApprovedProjects.tsx` per riflettere il nuovo flusso.
3. **UI**
   - Rimuovere o deprecare la rotta `/quotes` e `/quotes/:id`.
   - Aggiungere in `Offers.tsx` filtro per origine "Da budget".
   - Aggiungere in `OfferDetail.tsx` il riferimento al budget/progetto di origine.
4. **Edge functions**
   - Rimpiazzare `generateQuoteForBudget` con `generateOfferFromBudget`.
   - Assicurarsi che `invoice-issue` e `fic-adapter` supportino offerte generate da budget.
5. **PDF**
   - Valutare se unificare il template PDF: `generatePdfQuote` può diventare un wrapper che usa `offer-public/pdf.ts` con i dati di un'offerta.

### Fase 3 — Migrazione e test (1-2 giorni)

1. Eseguire la migrazione dati in staging/preview.
2. Verificare che ogni preventivo storico abbia un'offerta corrispondente con:
   - numero originale preservato (o mappato in note),
   - stato corretto,
   - totale congruente.
3. Testare il flusso end-to-end: budget approvato → offerta generata → invio → firma → coda fatture.
4. Rilasciare in produzione con rollback plan (ripristinare backup se necessario).

## Rischi e decisioni da prendere

- **Numerazione**: i preventivi hanno numeri `PREV-YYYY-NNN` già emessi ai clienti. Non possono essere "persi". Soluzione: conservare `quotes` in read-only o mappare il numero nel campo note dell'offerta.
- **Pagamenti**: `quote_payment_splits` usa `payment_mode_id` + `payment_term_id` + percentuale; `offer_payment_terms` usa eventi di maturazione. Serve una mappatura esplicita (es. `data_documento` → `firma`).
- **Permessi**: i preventivi sono visibili/modificabili da ruoli diversi rispetto alle offerte. Allineare `hasPermission`.
- **Integrazioni esistenti**: se altre edge function o report usano `quotes`/`quote_budgets`, vanno aggiornati.
- **Fatture in Cloud**: i preventivi non hanno `fic_id`; le offerte sì. La migrazione dovrà lasciare vuoto `fic_id` per i documenti storici.

## Prossimo passo

Decidere se procedere con **Opzione A** (confini chiari, interventi minimi) o **Opzione B** (consolidamento completo preventivi→offerte). Se si sceglie B, raccomando di iniziare con l'audit dati della Fase 1 prima di scrivere codice.
