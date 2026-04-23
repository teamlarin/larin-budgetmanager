

## Migliorare impaginazione Drive + Slack nell'header del Canvas

Nell'header del Project Canvas (immagine allegata), quando il titolo del progetto è lungo va a capo e i due pulsanti "Collega cartella Drive" / canale Slack si schiacciano nella colonna destra impilandosi uno sopra l'altro, in posizioni disallineate. Riorganizzo lo spazio per ottenere un'impaginazione pulita e coerente.

### Cosa cambia visivamente

**Prima (oggi)**
```text
[← Titolo lungo che va a capo                  ] [Collega cartella Drive ]
[   Canvas & Report Strategico                 ] [#p-milper-group-m...  ✓ × ]
```

**Dopo**
```text
[← Titolo lungo che va a capo                  ]   [📁 Collega Drive] [💬 #p-milper-...  ✓ ×]
[   Canvas & Report Strategico                 ]
```

I due pulsanti restano allineati orizzontalmente sulla stessa riga, agganciati in alto a destra dell'header, con larghezza coerente e nessun wrap interno della colonna.

### Modifiche tecniche

**File: `src/pages/ProjectCanvas.tsx`** (righe ~605-668, blocco header)

1. **Layout flex più robusto**
   - L'`<div>` esterno passa da `flex items-center justify-between` a `flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4`.
   - Su viewport stretti (sotto `lg`) i pulsanti scendono sotto il titolo, allineati a sinistra → niente più sovrapposizioni o squish.
   - Su `lg` e oltre, titolo a sinistra (può crescere su due righe) e cluster pulsanti a destra allineato in alto (`lg:items-start`).

2. **Cluster pulsanti compatto**
   - Il contenitore dei due picker passa da `flex flex-wrap items-center gap-2` a `flex items-center gap-2 shrink-0` (no wrap interno, resta sempre orizzontale).
   - Aggiungo `flex-1 min-w-0` al blocco titolo a sinistra così il troncamento avviene nel titolo, non nei pulsanti.

3. **Coerenza visiva tra i due trigger**
   - Aggiungo a entrambi i pulsanti la stessa altezza (`h-9`) e padding (`px-3`) per allinearli perfettamente.
   - Il trigger Drive vuoto resta "Collega cartella Drive"; quando una cartella è collegata, accorcio il label in `currentFolderName` truncato a 20 caratteri con `max-w-[180px] truncate` per uniformarsi al picker Slack che già usa `max-w-[220px] truncate`.

4. **Pulsanti unlink/X**
   - I due pulsanti `ghost` di scollegamento (Drive `Unlink`, Slack `X`) restano `size="icon" h-8 w-8` ma li raggruppo dentro lo stesso flex-row → niente salto verticale.

### File toccati

- `src/pages/ProjectCanvas.tsx` — solo il blocco header (righe ~605-668)
- `src/components/ProjectDriveFolderSelector.tsx` — uniformare classi del bottone trigger (altezza + truncate label)

Nessuna modifica logica, di permessi, di RLS o di stato. Solo CSS/Tailwind sui contenitori e sui trigger.

