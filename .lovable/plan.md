

## Riordinamento task nei modelli workflow

### Obiettivo
Aggiungere pulsanti freccia su/giù per riordinare i task nel dialog di creazione/modifica modello.

### Implementazione

**File: `src/components/workflows/CreateTemplateDialog.tsx`**

1. Aggiungere import di `ArrowUp` e `ArrowDown` da lucide-react (l'icona `GripVertical` è già importata ma non usata — verrà rimossa)

2. Aggiungere una funzione `moveTask(index, direction)` che:
   - Scambia il task alla posizione `index` con quello sopra/sotto
   - Ricalcola gli `order` di tutti i task
   - Aggiorna i riferimenti `dependsOn`: se un task dipende da un task che ora ha una posizione successiva rispetto alla propria, il `dependsOn` viene resettato a `null` (le dipendenze possono puntare solo a task precedenti)

3. Nella UI di ogni task, sostituire il numero statico con due pulsanti freccia (su/giù) accanto al numero d'ordine:
   - Freccia su: disabilitata per il primo task
   - Freccia giù: disabilitata per l'ultimo task
   - Stile compatto (`ghost`, `size="icon"`, `h-6 w-6`)

### Dettagli tecnici

```ts
const moveTask = (index: number, direction: 'up' | 'down') => {
  const newIndex = direction === 'up' ? index - 1 : index + 1;
  setTasks(prev => {
    const updated = [...prev];
    [updated[index], updated[newIndex]] = [updated[newIndex], updated[index]];
    return updated.map((t, i) => ({
      ...t,
      order: i + 1,
      // Reset dependsOn if it now points to a task at or after this position
      dependsOn: t.dependsOn
        ? (updated.findIndex(x => x.id === t.dependsOn) < i ? t.dependsOn : null)
        : null,
    }));
  });
};
```

Nessuna modifica al backend. Solo modifica a `CreateTemplateDialog.tsx`.

