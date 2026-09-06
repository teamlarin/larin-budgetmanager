# Focus settimanale: progetti interni senza segnalazioni di budget e aggiornamenti

## Obiettivo
Nella dashboard "La mia settimana", i progetti con area `interno` restano visibili nel focus, ma non devono più generare segnalazioni legate al budget consumato ("budget al X%") né alla mancanza di aggiornamenti ("nessun aggiornamento", "fermo da N settimane"). Restano attive le segnalazioni operative: scadenze imminenti/superate e ore pianificate.

## Modifica
File: `src/hooks/useWeeklyFocus.ts` (sezione di aggregazione per progetto, righe ~229-270).

1. Calcolare `const isInternal = String(p.area ?? '').toLowerCase() === 'interno';` all'inizio del mapping.
2. Racchiudere in `if (!isInternal) { ... }` i due blocchi:
   - **Budget**: `classifyBudget(budgetConsumedPct)` con i motivi "budget al X%" (sia critical che warning) — inclusi i punti del punteggio (25 / 10).
   - **Aggiornamenti**: i motivi "nessun aggiornamento" e "fermo da N settimane" — incluso il punteggio (+10).
3. Scadenza e ore pianificate restano invariate per tutti i progetti, interni compresi.

## Effetti collaterali (coerenti)
- Un progetto interno senza scadenza vicina e senza ore pianificate avrà punteggio 0 e non comparirà nel focus (comportamento già esistente per punteggio 0): niente più progetti interni che compaiono solo perché "senza aggiornamenti".
- Il valore `budgetConsumedPct` resta calcolato e disponibile nel dato (non visualizzato come chip); nessuna modifica ad altre viste (tab Progetti, Progetti Approvati, canvas).

## Non incluso
- Nessun cambiamento al filtro area già presente (l'utente può comunque filtrare/escludere l'area interno dal selettore).
- Il pulsante "Aggiorna progresso" sulla card resta disponibile (l'utente può comunque aggiornare manualmente, semplicemente non viene sollecitato).
- Nessuna modifica a RLS o ad altre dashboard.

## Verifica
- `npx tsgo --noEmit -p tsconfig.app.json`
- `npx vitest run` (eventuale test su un progetto con area `interno`: nessun motivo budget/aggiornamenti)
