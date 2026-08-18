# Aggiungere attività personalizzate dentro una sezione del budget

## Situazione attuale

Nella pagina di un budget/progetto (`/projects/:id`) le voci sono raggruppate in sezioni: ogni sezione corrisponde al servizio/template di origine (`source_template_id`), più due sezioni di fallback ("Prodotti" e "Attività personalizzate").

Il pulsante "Aggiungi Elemento" è unico, in testa alla pagina: una nuova attività personalizzata viene salvata senza servizio di origine, quindi finisce sempre nella sezione generica "Attività personalizzate". Non esiste oggi un modo per inserirla dentro una sezione già esistente, né per spostarla dopo.

## Cosa costruire

1. **Pulsante "Aggiungi attività" su ogni intestazione di sezione**
   - Accanto all'icona di eliminazione del gruppo, visibile solo a chi può modificare.
   - Apre la stessa modale di creazione voce, già "agganciata" alla sezione: la nuova voce viene creata all'interno di quel servizio.
   - Nell'intestazione della modale viene indicato in quale sezione si sta inserendo.
   - Se il gruppo ha una disciplina, la modale parte con quel contesto; funziona sia per attività personalizzate che per attività da catalogo e prodotti.
   - Inserendo da "Prodotti" o "Attività personalizzate" la voce resta in quella sezione (comportamento attuale).

2. **Spostare una voce esistente in un'altra sezione**
   - Nel menu azioni della riga (dove ci sono Modifica / Duplica / Elimina) si aggiunge "Sposta in sezione…" con l'elenco delle sezioni presenti nel budget (più "Attività personalizzate").
   - Lo spostamento aggiorna solo l'appartenenza alla sezione, lasciando invariati ore, tariffe e totali.

3. **Coerenza dopo il salvataggio**
   - Le voci nuove compaiono in fondo alla sezione scelta e restano riordinabili con il drag & drop esistente.
   - I totali di sezione e i totali del budget si ricalcolano come già avviene oggi.

## Dettagli tecnici

- `src/components/BudgetManager.tsx`
  - `SortableGroupHeader`: nuova prop `onAddItem` e relativo bottone (icona "+"), con `stopPropagation` per non collassare il gruppo.
  - Nuovo stato `addToGroup: { key, label, templateId } | null`; `BudgetItemForm` riceve `presetSourceTemplateId` e `presetGroupLabel`.
  - `handleAddItem`: usa `presetSourceTemplateId` come fallback quando la voce non porta già un `sourceTemplateId` (le attività importate da template mantengono il proprio).
  - `handleUpdateItem`: includere `source_template_id` nel payload per non perdere/poter cambiare la sezione.
  - Nuova mutation `handleMoveItemToGroup(itemId, templateId | null)` con `refetch()` + `updateBudgetTotals()`.
- `src/components/BudgetItemForm.tsx`: accetta le due nuove prop opzionali, mostra la sezione di destinazione nel titolo e propaga `sourceTemplateId` nell'oggetto restituito da `onSubmit` (anche nel percorso "attività personalizzata" e prodotto).
- `src/components/SortableRow` (stesso file): menu a tendina esteso con il sottomenu "Sposta in sezione…" alimentato dalle sezioni calcolate in `groupedItems`.
- Nessuna modifica al database: `budget_items.source_template_id` esiste già.
