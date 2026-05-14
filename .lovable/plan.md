## Problema

In `HrBudgetDashboard.tsx`, quando il toggle "Mostra cessati" è disattivato (default), i dipendenti cessati vengono rimossi **completamente** dal dataset usato per calcolare KPI, totali e barre per team (riga 62: `if (!showCessati && isCessato(e)) return false`).

Questo è scorretto per i totali di costo: un dipendente cessato a giugno dovrebbe comunque contribuire al "Costo effettivo anno" per i mesi gen–giu (la logica in `calcEmployee` già azzera i mesi dopo `data_fine`, quindi il loro `totalActual` è già correttamente troncato alla data di cessazione).

## Soluzione

Separare due concetti:
- **Visibilità in tabella**: governata dal toggle "Mostra cessati" (comportamento attuale).
- **Inclusione nei totali**: i cessati contribuiscono sempre ai totali di costo per i mesi in cui erano attivi.

### Modifiche a `src/components/dashboards/HrBudgetDashboard.tsx`

1. Rinominare/duplicare il dataset:
   - `calcDataAll` (nuovo): applica solo i filtri di ricerca/team/contratto/pianificati, **senza** filtrare i cessati. Usato per KPI e team bars.
   - `calcData` (esistente): aggiunge il filtro `showCessati` sopra a `calcDataAll`. Usato per la tabella.

2. Aggiornare le sorgenti dei calcoli aggregati:
   - `kpis` useMemo → basato su `calcDataAll` invece di `calcData`. Il calcolo di `inCarica`/`uniqueInCarica` continua a escludere i cessati (già fatto via `!isCessato(e)`), quindi metriche come età media, anzianità, gender split restano invariate. Cambia solo `totalActual`, che ora include i mesi dei cessati fino a `data_fine`.
   - `teamBars` useMemo → basato su `calcDataAll` per includere il costo dei cessati per team.
   - `sortedData` e l'export CSV restano basati su `calcData` (rispettano la visibilità della tabella).

3. Aggiornare il `totalActual` nel footer della tabella (riga 186): considerare se mostrare il totale della tabella visibile (comportamento attuale, basato su `sortedData`) oppure il totale globale incluso cessati. Proposta: mantenere il totale della tabella visibile ma aggiungere una piccola annotazione quando `showCessati` è off, indicando che i cessati sono esclusi dalla riga ma inclusi nel KPI in alto.

## Nessuna modifica a logica HR/database

Tutta la correzione è frontend: `calcEmployee` già tronca i mesi a `data_fine`, quindi non serve toccare `src/lib/hrCalculations.ts` né lo schema.