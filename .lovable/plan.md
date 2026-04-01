

## Discrepanza ore confermate Alessia Da Deppo — Marzo

### Causa identificata

I due contesti usano **formule diverse** per calcolare le ore confermate:

| Contesto | Formula |
|---|---|
| **Calendario** (`Calendar.tsx`, riga 1091) | Quando un'attività ha `actual_start_time` e `actual_end_time`, conta la **durata pianificata** (`scheduled_start_time → scheduled_end_time`) |
| **Riepilogo ore** (`UserHoursSummary.tsx`, riga 171) | Usa la **durata effettiva** (`actual_start_time → actual_end_time`) |

Quindi se un'attività è pianificata 9:00–18:00 (9h) ma confermata con orari effettivi 9:00–17:30 (8h30m), il calendario conta 9h e la dashboard 8h30m.

La differenza di **2h 30m** (202h15m nel calendario vs 199h45m nella dashboard) è coerente con questa discrepanza.

### Correzione proposta

Allineare il calendario alla stessa logica della dashboard: quando un'attività è confermata, usare `actual_start_time → actual_end_time` per il conteggio ore confermate.

**File da modificare:** `src/pages/Calendar.tsx`

Riga 1091, da:
```typescript
if (t.actual_start_time && t.actual_end_time) confirmedMinutes += duration;
```

A:
```typescript
if (t.actual_start_time && t.actual_end_time) {
  confirmedMinutes += calculateTimeMinutes(t.actual_start_time, t.actual_end_time);
}
```

Questo allineerà i totali giornalieri e settimanali del calendario con quelli del riepilogo ore team.

### Nessuna modifica a `UserHoursSummary.tsx`
La logica del riepilogo è corretta — usa i tempi effettivi come ci si aspetta.

