# Tasso di utilizzo: contare anche le chiusure aziendali tra le assenze

## Obiettivo

Nella tab "Progetti" del cruscotto, il tasso di utilizzo del team oggi sottrae dalla capacità solo le ore registrate sul progetto "Larin OFF" (ferie, permessi, malattia, banca ore). I giorni di chiusura aziendale configurati in Impostazioni (festività ricorrenti, chiusure straordinarie, Pasqua e Pasquetta) restano invece dentro la capacità, gonfiandola e abbassando il tasso di utilizzo in modo irreale.

Con questa modifica i giorni di chiusura che cadono su un giorno lavorativo (lun-ven) dentro il periodo selezionato vengono conteggiati come assenza, riducendo la capacità netta dei dipendenti. I freelance non seguono le chiusure aziendali, quindi la loro capacità non viene ridotta.

## Cosa cambia

1. **Lettura delle chiusure** (`src/components/sales/useOperationsData.ts`):
   - dentro `useTeamUtilization` si legge `app_settings` con chiave `closure_days` e si riusa la logica di Pasqua/Pasquetta già esistente (`calculateEasterDate` / `calculateEasterMondayDate` da `src/hooks/useClosureDays.ts`) per ottenere le date di chiusura del periodo;
   - si contano solo le chiusure che cadono su un giorno lavorativo (lun-ven) tra `start` e `end` del periodo.
2. **Calcolo per persona**: per ogni membro, le ore di chiusura = ore giornaliere da contratto × giorni di chiusura lavorativi (usando `dailyContractHours` su `src/lib/capacity.ts`, quindi il contratto effettivo del periodo, periodi contrattuali inclusi).
3. **Assenze totali**: le ore di chiusura si sommano alle ore "Larin OFF" nel campo `absenceHours` (la capacità netta scende di conseguenza), senza introdurre una colonna separata: la definizione di assenza resta unica.
4. **Coerenza**: la stessa riduzione vale sia per il tasso di utilizzo (aree sales/struttura e contratti consuntivo esclusi) sia per la capacità residua (escluse solo sales/struttura), perché entrambe leggono `capacityNet`/`absenceHours` dei membri.
5. **Test**: in `src/test/operations-metrics.test.ts` (o un nuovo test mirato) si aggiunge un caso puro: funzione che, dato il numero di giorni lavorativi e i giorni di chiusura nel periodo, restituisce i giorni lavorativi effettivi.

## Dettagli tecnici

- Per non duplicare la logica, si estrae da `useClosureDays.ts` una funzione pura (es. `getClosureDatesForRange(start, end, settings)`) riusata sia dall'hook sia dal cruscotto; Pasqua/Pasquetta restano incluse.
- Le chiusure non ricorrenti (data piena `YYYY-MM-DD`) contano solo se cadono nel periodo; quelle ricorrenti (`MM-DD`) si applicano all'anno del periodo.
- Nessuna modifica a database, RLS o Edge Function: tutto lato client.
- Verifica: `bunx tsgo` per i tipi, `vitest` sui test interessati, build.

## Fuori scope

- Nessun cambiamento alle altre viste (Team settimanale, Riepilogo ore, Banca ore): la richiesta riguarda solo il tasso di utilizzo del cruscotto.
