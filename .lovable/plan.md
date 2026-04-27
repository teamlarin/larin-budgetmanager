## Obiettivo

Nelle sezioni raggruppate per modello del `BudgetManager`, mostrare il totale di ore e importo per gruppo e consentire l'eliminazione massiva di tutte le attività appartenenti allo stesso modello (o al gruppo "Attività personalizzate" / "Prodotti") con una sola azione.

## Modifiche

### `src/components/BudgetManager.tsx`

1. **Calcolo totali per gruppo**
   - Estendere il tipo `ItemGroup` con `totalHours: number` e `totalCost: number`.
   - Nel `useMemo` di `groupedItems`, accumulare per ciascuna voce:
     - `totalHours += item.estimatedHours ?? 0`
     - `totalCost += item.total ?? (item.unitPrice * item.quantity)` (riusare la stessa formula già usata nel `budgetSummary` per coerenza).

2. **Header di gruppo aggiornato (riga `bg-muted/40`)**
   - A destra del conteggio voci, mostrare due badge/etichette:
     - Ore totali del gruppo (formattate con `formatHours` se disponibile, altrimenti `X h`).
     - Importo totale del gruppo (formattato con il formatter valuta già in uso, es. `formatCurrency`).
   - Aggiungere, solo se `canEdit`, un pulsante icona `Trash2` (variant ghost, size sm) all'estrema destra dell'header per "Elimina tutto il gruppo".

3. **Eliminazione massiva del gruppo**
   - Nuovo handler `handleDeleteGroup(group: ItemGroup)`:
     - Mostra un `AlertDialog` di conferma con il nome del gruppo e il numero di voci (`Eliminare le N attività di "<label>"?`).
     - Alla conferma esegue una singola `supabase.from('budget_items').delete().in('id', group.items.map(i => i.id))`.
     - Dopo il successo: `await refetch()` + `await updateBudgetTotals()` + toast di conferma.
     - Gestione errori coerente con `handleDeleteItem`.
   - Stato locale `groupToDelete: ItemGroup | null` per pilotare l'AlertDialog (riusare `AlertDialog` già importato in pagina; se non importato, aggiungere import dai componenti shadcn `@/components/ui/alert-dialog`).

4. **Layout header gruppo (proposta)**

```text
[Nome modello] [Badge disciplina]   N voci · Xh · € Y   [🗑]
```

Il pulsante elimina è visibile solo per chi ha `canEdit`.

### Nessuna modifica a

- Database / migrazioni (la struttura `source_template_id` esiste già).
- `BudgetItemForm`, tipi, hook.
- Logica di drag&drop (la `SortableContext` continua a operare sull'array piatto `budgetItems`).

## Note tecniche

- L'eliminazione di gruppo usa una singola query `.in('id', [...])` per minimizzare round-trip.
- I totali del gruppo vengono ricalcolati a partire dagli stessi campi già usati in `budgetSummary`, così sono allineati al totale del budget (somma dei gruppi = totale budget, prodotti esclusi se già esclusi altrove — comportamento mantenuto invariato, qui mostriamo solo la somma "grezza" delle voci del gruppo).
- Per i gruppi fallback (`__products__`, `__custom__`) il pulsante elimina-tutto funziona allo stesso modo.
