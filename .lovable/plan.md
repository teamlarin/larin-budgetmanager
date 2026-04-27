## Obiettivo

Nel form "Nuovo Elemento Budget" e nel relativo flusso:

1. Rimuovere la tab **Prodotti** (i prodotti verranno gestiti come Servizi).
2. Migliorare il **selettore del modello di budget**: raggruppato per **disciplina** e con **descrizione del modello in tooltip/hover**.
3. Permettere la **selezione di più modelli** in un singolo budget e visualizzare le attività **raggruppate per modello di provenienza** nella tabella del budget.

---

## Cosa cambia per l'utente

### Form "Nuovo Elemento Budget"
- Solo **2 tab**: `Modelli di budget` e `Attività personalizzata`. La tab `Prodotti` viene rimossa (i prodotti rimangono modificabili sui record esistenti, ma non si possono più crearne di nuovi da qui — useranno i Servizi).
- Nella tab `Modelli di budget`:
  - Il dropdown raggruppa i modelli per **disciplina** (es. "Content Creation & Storytelling", "Brand Identity & Visual Design", ecc.) con headers visivi.
  - Su ogni modello in lista, hover con icona info → **tooltip con la descrizione** del modello (oltre al riepilogo ore/costo già presente).
  - Si possono **selezionare più modelli successivamente**: dopo aver scelto attività dal modello A e averle confermate, riaprendo il dialog si può selezionare il modello B e così via. (Mantenere la UX attuale "un modello per volta dentro il dialog" — la combinazione avviene a livello di budget, non di singola apertura.)

### Tabella attività del budget
- Le attività sono **raggruppate visivamente per modello di provenienza** con header di sezione (nome modello + disciplina come badge). Le attività personalizzate finiscono in un gruppo "Personalizzate"; i prodotti esistenti in un gruppo "Prodotti".
- Drag & drop e ordinamento continuano a funzionare all'interno di ogni gruppo.

---

## Dettagli tecnici

### Database (migration)
Aggiungere a `budget_items` un riferimento al modello di provenienza:
- `source_template_id uuid NULL REFERENCES budget_templates(id) ON DELETE SET NULL`

Nessun altro cambio RLS necessario.

### `BudgetItemForm.tsx`
- Rimuovere `TabsTrigger value="product"` e tutto il blocco `TabsContent value="product"`. La griglia diventa `grid-cols-2`.
- Rimuovere stati: `selectedProduct`, `productSearchQuery`, `products` (e fetch). Rimuovere `handleProductSelect` e i campi `productId/productCode/productDescription` dal `formData` per le nuove creazioni (mantenere il blocco edit prodotto solo quando `isEditing && initialData.isProduct`).
- Caricare `discipline` dei templates (già presente in DB) nel fetch.
- Sostituire il `<Select>` flat dei modelli con uno raggruppato:
  - Raggruppare i template lato client per `discipline` usando `DISCIPLINE_LABELS`.
  - Renderizzare `<SelectGroup>` con `<SelectLabel>` per ogni disciplina, ordinate alfabeticamente per label.
  - Ogni `<SelectItem>` mostra nome + ore/costo. Aggiungere un piccolo `<HoverCard>` (o `<Tooltip>`) con icona `Info` accanto al nome che mostra la `description` del modello (fallback "Nessuna descrizione" se vuota).
- Quando si conferma la selezione di attività da un modello, passare `sourceTemplateId: selectedTemplate.id` in ciascun item creato (`handleSubmit`, ramo multi-select).

### `BudgetManager.tsx`
- Estendere il mapping di `budget_items` includendo `source_template_id` → `sourceTemplateId` nel tipo `BudgetItem`.
- In `handleAddItem`, passare `source_template_id: newItem.sourceTemplateId ?? null` nell'insert.
- Nella tabella, raggruppare `budgetItems` per `sourceTemplateId`:
  - Caricare in parallelo i `budget_templates` referenziati (id, name, discipline) per mostrare nome + badge disciplina nell'header di gruppo.
  - Gruppi speciali per items senza template:
    - `is_product = true` → gruppo "Prodotti"
    - altrimenti → gruppo "Attività personalizzate"
  - Ogni gruppo è una sezione con riga header (TableRow con `colSpan` pieno, sfondo `muted/30`) seguita dalle SortableRow del gruppo. Drag & drop e display_order rimangono per-item come oggi.

### `types/budget.ts`
- Aggiungere `sourceTemplateId?: string | null` a `BudgetItem`.

### File toccati
- `supabase/migrations/<timestamp>_budget_items_source_template.sql` (nuovo)
- `src/types/budget.ts`
- `src/components/BudgetItemForm.tsx`
- `src/components/BudgetManager.tsx`
- `src/integrations/supabase/types.ts` (rigenerato dal cambio schema)

---

## Note

- I budget esistenti continueranno a funzionare: gli item con `source_template_id = NULL` finiranno automaticamente nel gruppo "Attività personalizzate" o "Prodotti".
- I prodotti già presenti restano editabili/eliminabili: cambia solo che non si aggiungono più dal dialog "Nuovo Elemento Budget".
- I `Select` di Radix richiedono almeno un `SelectItem` per gruppo — i gruppi vuoti vengono nascosti.
- Se la selezione di un modello viene cambiata mid-dialog, la lista delle attività selezionate viene azzerata (comportamento attuale, mantenuto).
