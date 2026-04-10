

## Fix: Formattazione descrizione budget

### Problema
La descrizione del budget (riga 349 di `ProjectBudget.tsx`) viene renderizzata come semplice testo in un `<p>`, quindi gli a capo e gli spazi multipli inseriti dall'utente vengono ignorati dal browser.

### Intervento

**File: `src/pages/ProjectBudget.tsx`** - riga 349

Aggiungere la classe CSS `whitespace-pre-wrap` al tag `<p>` che mostra la descrizione. Questo preserva gli a capo (`\n`) e gli spazi multipli inseriti dall'utente.

```tsx
// Da:
<p className="text-muted-foreground flex-1">{project.description || 'Nessuna descrizione'}</p>

// A:
<p className="text-muted-foreground flex-1 whitespace-pre-wrap">{project.description || 'Nessuna descrizione'}</p>
```

Nessun'altra modifica necessaria.

