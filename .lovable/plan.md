

## Mostrare ore "banca ore" separatamente nel riquadro confermate del calendario

### Cosa cambia
Nel riquadro "Confermate" dell'header settimanale del calendario, le ore di banca ore verranno mostrate come sotto-indicazione separata (es. "39h 45m" con sotto "di cui 6h 30m banca ore"), mantenendole incluse nel totale.

### Modifiche tecniche

**1. `src/pages/Calendar.tsx`** — calcolo `dailyTotals` (~riga 1082)
- Aggiungere un contatore `bancaOreMinutes` per giorno
- Identificare le attività banca ore con la stessa logica della dashboard (`/off/i` nel project_name + `/banca\s*ore/i` nell'activity_name)
- Usare `calculateSafeHours` per calcolare correttamente le ore da timestamp ISO
- Restituire `{ planned, confirmed, bancaOre }` per ogni giorno

**2. `src/pages/Calendar.tsx`** — calcolo `weeklyTotals` (~riga 1119)
- Sommare anche `bancaOre` nel reduce
- Passare `weeklyTotals` (ora con campo `bancaOre`) al `CalendarHeader`

**3. `src/components/calendar/CalendarHeader.tsx`**
- Aggiornare il tipo di `weeklyTotals` per includere `bancaOre: number`
- Nel riquadro "Confermate" (riga 129-135), se `weeklyTotals.bancaOre > 0`, mostrare sotto il totale una riga aggiuntiva:
  ```
  Confermate
  39h 45m
  di cui 6h 30m banca ore
  ```
  La riga "di cui..." sarà in testo più piccolo e colore muted.

