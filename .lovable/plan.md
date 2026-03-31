

## Fix: Ore maggiorate nel dettaglio e attività senza time entry nel riepilogo

### Problemi

1. **Registrazioni dettaglio non mostrano ore maggiorate**: La Edge Function è stata aggiornata nel codice ma probabilmente non è stata ri-deployata. Va deployata.

2. **Riepilogo per Attività mostra solo attività con time entry**: L'`activitySummary` nella Edge Function viene costruito iterando solo sulle `timeEntries` — le attività di budget senza registrazioni confermate non compaiono.

### Piano

#### 1. Edge Function `public-timesheet/index.ts` — includere tutte le attività nel riepilogo

Nella sezione "Build activity summary" (righe 194-210), dopo aver aggregato le ore dalle time entries, aggiungere un ciclo su tutti i `budgetItems` per includere quelli che non hanno nessuna time entry collegata (con `confirmedHours: 0`):

```typescript
// After aggregating time entries, add budget items with no entries
for (const bi of budgetItems) {
  if (!activityHoursMap[bi.id]) {
    activityHoursMap[bi.id] = {
      activityName: bi.activity_name,
      category: bi.category,
      confirmedHours: 0,
      budgetHours: Number(bi.hours_worked) || 0
    };
  }
}
```

#### 2. Deploy della Edge Function

Dopo la modifica, deployare `public-timesheet` per rendere effettive sia le maggiorazioni (già nel codice) sia le attività senza time entry.

### File coinvolti

| File | Modifica |
|------|----------|
| `supabase/functions/public-timesheet/index.ts` | Aggiungere budget items senza time entry all'activitySummary |

