

## Fix: Ore maggiorate e dettaglio registrazioni nel timesheet pubblico

### Problemi identificati

1. **Ore non maggiorate nel link pubblico**: La Edge Function `public-timesheet` non legge la tabella `project_timesheet_adjustments`, quindi tutte le ore mostrate sono quelle grezze, senza le maggiorazioni per utente o categoria.

2. **Export Excel pubblico non rispetta `hide_detail`**: L'export Excel nella pagina pubblica include sempre il foglio "Dettaglio" con l'elenco delle registrazioni, anche quando `hide_detail=1`.

### Piano di implementazione

#### 1. Edge Function `public-timesheet` — aggiungere maggiorazioni

Nella funzione `supabase/functions/public-timesheet/index.ts`:

- Dopo aver recuperato il progetto, fare una query aggiuntiva su `project_timesheet_adjustments` filtrando per `project_id`
- Costruire le mappe `userAdjustments` e `categoryAdjustments` (come fa già `ProjectTimesheet.tsx`)
- Nel calcolo delle ore di ogni entry, applicare la maggiorazione cumulativa (utente + categoria):
  ```
  ore_contabili = ore_base × (1 + (adj_utente + adj_categoria) / 100)
  ```
- Applicare la stessa logica anche al calcolo dell'`activitySummary`
- Restituire nel JSON sia le ore grezze (`hours`) che le ore contabili (`accountingHours`) per ogni entry, e il totale `totalAccountingHours` maggiorato

#### 2. Pagina `PublicTimesheet.tsx` — mostrare ore contabili

- Aggiornare l'interfaccia `TimeEntry` per includere `accountingHours`
- Nella tabella dettaglio e nel riepilogo, mostrare le ore contabili (maggiorate) invece delle ore grezze
- Aggiornare il totale ore nella card sommario

#### 3. Export Excel pubblico — rispettare `hide_detail`

In `PublicTimesheet.tsx`, nella funzione `exportToExcel`:

- Aggiungere il foglio "Dettaglio" solo se `!hideDetail`
- Il foglio "Riepilogo" resta sempre presente
- Usare le ore contabili (maggiorate) nel riepilogo e nel dettaglio

### File coinvolti

| File | Modifica |
|------|----------|
| `supabase/functions/public-timesheet/index.ts` | Query adjustments, calcolo ore maggiorate |
| `src/pages/PublicTimesheet.tsx` | Mostrare `accountingHours`, condizionare foglio Dettaglio in export |

