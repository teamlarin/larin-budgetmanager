

## Dettaglio mensile per utente e rettifiche manuali ore

### Obiettivo
1. Espandere ogni riga utente per vedere il dettaglio mese per mese (da gennaio al mese selezionato)
2. Permettere di inserire rettifiche manuali sulle ore confermate per specifici mesi

### Database

**Nuova tabella `user_hours_adjustments`**:
- `id` uuid PK
- `user_id` uuid NOT NULL (riferimento profilo)
- `month` date NOT NULL (primo giorno del mese, es. 2026-01-01)
- `adjustment_hours` numeric NOT NULL (ore da aggiungere/sottrarre)
- `reason` text (motivazione)
- `created_by` uuid NOT NULL
- `created_at`, `updated_at` timestamptz

Vincolo unique su `(user_id, month)` per evitare duplicati.

RLS: admin/coordinator possono gestire, approved users possono leggere.

### UI — File: `src/components/dashboards/UserHoursSummary.tsx`

1. **Riga espandibile**: aggiungere un pulsante ChevronDown su ogni riga utente. Al click, mostra una sotto-tabella con una riga per ogni mese da gennaio al mese corrente selezionato, con colonne: Mese, Ore Confermate, Rettifica, Ore Totali (confermate + rettifica), Ore Previste, Saldo.

2. **Query mensile dettagliata**: quando si espande un utente, caricare le ore confermate mese per mese (query `activity_time_tracking` raggruppata per mese) e le rettifiche dalla nuova tabella `user_hours_adjustments`.

3. **Rettifica manuale**: nella colonna "Rettifica" della sotto-tabella, mostrare il valore attuale (se presente) con un pulsante edit. Al click apre un piccolo dialog/popover con input numerico (ore, positivo o negativo) e campo "Motivazione". Salva su `user_hours_adjustments` con upsert.

4. **Ricalcolo saldi**: il "Saldo" mensile e il "Saldo Anno" nella riga principale devono includere le rettifiche. Il saldo mese diventa `(confirmedHours + adjustment) - expectedHours`. Il saldo anno somma tutti i mesi.

5. **Query adjustments**: aggiungere una `useQuery` per caricare tutte le `user_hours_adjustments` dell'anno corrente, indicizzate per `user_id + month`. Questi dati vengono usati sia nella riga principale (per il saldo anno) sia nella sotto-tabella espansa.

### Dettagli tecnici
- La sotto-tabella usa `Collapsible` di radix con stato `expandedUserId` (uno alla volta)
- Query ore per mese: una singola query YTD già esistente, raggruppata client-side per `scheduled_date` troncato al mese
- La query YTD esistente viene estesa per restituire anche il mese di ogni entry, così da poter aggregare per mese
- L'upsert delle rettifiche usa `.upsert()` con `onConflict: 'user_id,month'`
- Permessi di modifica rettifica solo per admin/coordinator (verificato client-side con `useRolePermissions`)

