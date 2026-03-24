

## Campo "Riporto Anno Precedente" nel Riepilogo Ore Team

### Obiettivo
Aggiungere per ogni utente un campo "riporto anno precedente" (ore in positivo o negativo) che viene sommato al Saldo Anno senza alterare i saldi mensili.

### Database

**Nuova colonna nella tabella `user_hours_adjustments`** — NO, meglio un approccio dedicato:

**Nuova tabella `user_hours_carryover`**:
- `id` uuid PK
- `user_id` uuid NOT NULL
- `year` integer NOT NULL (es. 2026)
- `carryover_hours` numeric NOT NULL (positivo o negativo)
- `notes` text (motivazione opzionale)
- `created_by` uuid NOT NULL
- `created_at`, `updated_at` timestamptz
- Vincolo unique su `(user_id, year)`

RLS: admin/finance possono gestire, approved users possono leggere.

### UI — `src/components/dashboards/UserHoursSummary.tsx`

1. **Query carryover**: `useQuery` con chiave `['user-hours-carryover', year]` che carica tutti i riporti per l'anno selezionato, indicizzati per `user_id`

2. **Saldo Anno aggiornato**: il calcolo diventa `ytdConfirmed - ytdExpected + carryover`. I saldi mensili restano invariati.

3. **Colonna "Riporto"**: nella tabella principale, nuova colonna tra "Saldo Anno" e "Progresso" che mostra il valore di carryover (se diverso da zero). Per admin/finance, un pulsante edit inline apre un dialog per inserire/modificare il riporto.

4. **Dialog modifica riporto**: simile a quello delle rettifiche — input numerico (ore, + o -) e campo note. Salva con upsert su `user_hours_carryover`.

5. **Totale header**: il summary card "Saldo Anno" in alto includerà anche la somma dei riporti.

### File modificati
- Nuova migrazione SQL per `user_hours_carryover`
- `src/components/dashboards/UserHoursSummary.tsx` — query, colonna, dialog, calcolo
- `src/integrations/supabase/types.ts` — aggiornamento automatico

