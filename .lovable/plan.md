

## Mostrare scadenza link nella pagina pubblica del timesheet

### Modifiche

#### 1. Edge Function `supabase/functions/public-timesheet/index.ts`

Calcolare `expiresAt` dopo il check di scadenza (riga ~56) e includerlo in entrambe le risposte JSON (riga 102 e riga 226):

```typescript
const expiryDays = project.timesheet_token_expiry_days || 30;
const expiresAt = project.timesheet_token_created_at
  ? new Date(new Date(project.timesheet_token_created_at).getTime() + expiryDays * 86400000).toISOString()
  : null;
```

Aggiungere `expiresAt` dentro l'oggetto `project` nelle due risposte JSON.

Deploy della funzione dopo la modifica.

#### 2. `src/pages/PublicTimesheet.tsx`

- Aggiungere `expiresAt: string | null` all'interfaccia `TimesheetData.project`.
- Nel footer (riga 344), mostrare un badge con icona Calendar: "Valido fino al DD/MM/YYYY".
- Colore: verde se mancano >7 giorni, giallo se ≤7, rosso se scaduto.

### File coinvolti

| File | Modifica |
|------|----------|
| `supabase/functions/public-timesheet/index.ts` | Calcolare e restituire `expiresAt` |
| `src/pages/PublicTimesheet.tsx` | Mostrare data scadenza nel footer con badge colorato |

