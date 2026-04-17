
## Opzione B — Archivia per stato budget

Modifica puntuale a `src/pages/Index.tsx` (riga ~643): un budget va in archivio quando il suo `status` è `approvato` o `rifiutato`, indipendentemente dallo stato del preventivo collegato.

```ts
const isArchived = 
  project.status === 'approvato' || 
  project.status === 'rifiutato';
```

### Effetto
- I 6 budget approvati attualmente nella lista attiva si sposteranno in archivio
- I 14 già in archivio restano dove sono
- Comportamento futuro: appena un budget passa a `approvato`, esce dalla lista operativa

### File modificati
- `src/pages/Index.tsx` — sola riga della costante `isArchived`

Nessuna modifica a DB o altri componenti.
