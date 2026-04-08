

## Aggiungere conteggio siti per etichetta nel filtro

### Intervento

**File: `src/components/dashboards/KinstaSitesWidget.tsx`**

Nel `Select` per il filtro etichette, mostrare il conteggio dei siti per ogni etichetta accanto al nome. Anche per "Tutte le etichette" mostrare il totale.

1. Calcolare una mappa `labelCounts` nel `useMemo` delle `uniqueLabels`, che restituisce `{ name, count }[]` invece di `string[]`
2. Aggiornare le `SelectItem` per mostrare `{label.name} ({label.count})`
3. Aggiornare "Tutte le etichette" con `Tutte le etichette ({sites.length})`

### Dettaglio

```tsx
const labelsWithCount = useMemo(() => {
  if (!sites) return [];
  const counts = new Map<string, number>();
  sites.forEach(site => site.site_labels?.forEach(l => {
    counts.set(l.name, (counts.get(l.name) || 0) + 1);
  }));
  return Array.from(counts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}, [sites]);
```

Poi nel JSX:
```tsx
<SelectItem value="all">Tutte le etichette ({sites?.length || 0})</SelectItem>
{labelsWithCount.map(label => (
  <SelectItem key={label.name} value={label.name}>
    {label.name} ({label.count})
  </SelectItem>
))}
```

Modifica solo a `KinstaSitesWidget.tsx`.

