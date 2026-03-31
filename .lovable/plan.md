

## Scadenza link timesheet: mostrare data e durata configurabile

### Cosa cambia

1. **Nuova colonna `timesheet_token_expiry_days`** sulla tabella `projects` (default 30, nullable integer) per salvare la durata scelta dal PM.

2. **UI nel dialog "Condividi Timesheet"** (`ProjectTimesheet.tsx`):
   - Aggiungere un selettore di durata (7, 30, 60, 90 giorni) prima del pulsante di generazione link.
   - Mostrare la data di scadenza calcolata (`timesheet_token_created_at + expiry_days`) con un badge colorato (verde se mancano >7gg, giallo se <7gg, rosso se scaduto).
   - Salvare `timesheet_token_expiry_days` insieme al token quando si genera/rigenera il link.

3. **Edge Function `public-timesheet/index.ts`**:
   - Leggere `timesheet_token_expiry_days` dal progetto (fallback a 30 se null).
   - Usare quel valore al posto del `30` hardcoded nel check di scadenza.

### File coinvolti

| File | Modifica |
|------|----------|
| Migration SQL | `ALTER TABLE projects ADD COLUMN timesheet_token_expiry_days integer DEFAULT 30` |
| `src/components/ProjectTimesheet.tsx` | Select durata, mostrare scadenza, salvare expiry_days |
| `supabase/functions/public-timesheet/index.ts` | Leggere expiry_days, usarlo nel check scadenza |

### Dettagli tecnici

**Migration:**
```sql
ALTER TABLE projects ADD COLUMN timesheet_token_expiry_days integer DEFAULT 30;
```

**ProjectTimesheet.tsx — query progetto:**
Aggiungere `timesheet_token_created_at, timesheet_token_expiry_days` alla select nella query `project-data`.

**ProjectTimesheet.tsx — dialog condivisione:**
- Stato `shareDurationDays` (default 30) con Select a 4 opzioni (7/30/60/90).
- Nella mutation `generateTokenMutation`, salvare anche `timesheet_token_expiry_days: shareDurationDays`.
- Sotto il link generato, mostrare: "Scade il {data}" con badge di stato.

**Edge Function:**
```typescript
const expiryDays = project.timesheet_token_expiry_days || 30;
if (daysSinceCreation > expiryDays) { ... }
```

