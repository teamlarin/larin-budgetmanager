

## Fix: pagina bianca quando si modifica "Assegnato a"

### Problema

Il componente `Select` di Radix UI crasha quando `SelectItem` ha `value=""` (stringa vuota). Riga 603 di `ProjectBudget.tsx`:
```tsx
<SelectItem value="">Nessuno</SelectItem>
```
Inoltre, il valore iniziale del Select è `(project).assigned_user_id || ''` che è anch'esso stringa vuota quando non c'è assegnazione.

### Soluzione

Usare un valore sentinella (es. `"__none__"`) al posto della stringa vuota:

1. **Riga 600**: Cambiare il valore del Select da `|| ''` a `|| '__none__'`
2. **Riga 603**: Cambiare `<SelectItem value="">` a `<SelectItem value="__none__">`
3. **Riga 241 (`handleUpdateAssigned`)**: Convertire `"__none__"` in `null` prima di salvare:
   ```tsx
   const handleUpdateAssigned = async (assignedId: string) => {
     await handleUpdateField('assigned_user_id', assignedId === '__none__' ? null : assignedId, 'Assegnazione');
     setIsEditingAssigned(false);
   };
   ```

### File coinvolti

| File | Modifica |
|------|----------|
| `src/pages/ProjectBudget.tsx` | 3 righe: valore Select, SelectItem "Nessuno", handler |

