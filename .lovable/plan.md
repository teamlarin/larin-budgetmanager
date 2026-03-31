

## Budget "rifiutato" va in archivio

### Modifica

**File: `src/pages/Index.tsx`**, riga 604

Attualmente:
```tsx
const isArchived = project.quoteStatus === 'approved';
```

Diventa:
```tsx
const isArchived = project.quoteStatus === 'approved' || project.status === 'rifiutato';
```

Questo sposta i budget con stato "rifiutato" nella vista Archivio insieme a quelli con preventivo approvato.

