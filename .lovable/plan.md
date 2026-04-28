## Obiettivo

Nel `BudgetManager`, nella vista raggruppata per modello, rendere ogni gruppo un accordion (mostra/nascondi attività) e consentire il riordino dei gruppi tramite drag & drop.

## Modifiche

### `src/components/BudgetManager.tsx`

#### 1. Collapse / expand di ciascun gruppo

- Nuovo stato locale `collapsedGroups: Set<string>` (chiave = `group.key`, es. ID template, `__products__`, `__custom__`).
- L'header di gruppo diventa cliccabile e mostra a sinistra una `ChevronDown` / `ChevronRight` (lucide) in base allo stato.
- Le `TableRow` delle attività del gruppo vengono renderizzate solo se il gruppo non è collassato.
- Persistenza leggera in `localStorage` per budget corrente (chiave `budget-collapsed-groups:<budgetId>`), così ricaricando la pagina lo stato resta.
- Il pulsante "Elimina gruppo" e i totali rimangono sempre visibili nell'header anche quando collassato.
- `stopPropagation` sui pulsanti dell'header (delete, eventuali altri) per non scatenare il toggle.

#### 2. Drag & drop dei gruppi

- Affiancare un secondo livello di ordinamento ai gruppi, mantenendo intatto il drag&drop esistente delle singole righe.
- Strategia: due `DndContext` annidati non si possono usare; useremo **un singolo `DndContext`** con due `SortableContext` separati:
  - uno per l'ordine dei gruppi (items = array di `group.key`)
  - uno per le righe all'interno di ciascun gruppo (come oggi)
- Nell'`onDragEnd`, distinguere se l'`active.id` corrisponde a una chiave gruppo (prefissata `group:`) o a un id voce, e applicare la mutazione corretta.
- Aggiungere un mini-handle `GripVertical` nell'header del gruppo (visibile solo per `canEdit`) come trigger del drag, separato dall'area di click che fa il toggle accordion.

#### 3. Persistenza dell'ordine dei gruppi

- L'ordine dei gruppi è derivato oggi dall'ordine in cui appaiono le voci (primo `displayOrder`/template incontrato).
- Per persistere il riordino senza nuove colonne DB:
  - Quando l'utente trascina il gruppo A sopra B, ricalcoliamo `displayOrder` di tutte le voci in modo che le voci di A precedano quelle di B (usando blocchi contigui di `displayOrder`).
  - Si esegue un singolo `upsert` batch su `budget_items` con i nuovi `displayOrder`, poi `refetch()`.
- In questo modo il `groupedItems` (che ordina i gruppi in base alla prima occorrenza) riflette automaticamente il nuovo ordine.

#### 4. Dettagli UI

- Header gruppo (proposta layout):

```text
[⠿ handle] [▸/▾] Nome modello [Badge disciplina]   N voci · Xh · € Y   [🗑]
```

- Su click del corpo header (escluso handle e bottoni) si toggla l'accordion.
- Animazione: usare classi Tailwind esistenti (`transition-transform`) sull'icona chevron; le righe nascoste vengono semplicemente non renderizzate (no animazione complessa per non rompere il layout della tabella).

## Nessuna modifica a

- Schema DB, tipi (`BudgetItem` ha già `displayOrder`).
- `BudgetItemForm`, hook, altri componenti.

## Note tecniche

- Per l'id "gruppo" nel sortable, usare prefisso `group:<key>` per evitare collisioni con id reali delle voci.
- Validare in `onDragEnd` che `active` e `over` siano dello stesso "tipo" (entrambi gruppo o entrambi voce); cross-tipo viene ignorato.
- La riassegnazione di `displayOrder` per riordino gruppi è O(n) sulle voci del budget; si usa un solo upsert batch.
- Il `localStorage` per il collapse usa `JSON.stringify(Array.from(set))` ed è scoped per `budgetId`.
