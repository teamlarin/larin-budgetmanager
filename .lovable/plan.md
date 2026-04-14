

## Mostrare i risultati attesi per esteso nella tab Obiettivi

### Problema
La colonna "Descrizione" nella tabella obiettivi ha le classi `max-w-xs truncate` che tagliano il testo lungo.

### Soluzione
In `src/components/PerformanceReviewManagement.tsx` (riga 480), rimuovere `max-w-xs truncate` e aggiungere `whitespace-pre-wrap` per mostrare il testo completo su più righe.

```tsx
// Da:
<TableCell className="text-sm text-muted-foreground max-w-xs truncate">

// A:
<TableCell className="text-sm text-muted-foreground whitespace-pre-wrap">
```

