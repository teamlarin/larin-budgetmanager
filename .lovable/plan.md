## Modifica nome cartella Drive di progetto

Cambiare il formato del nome generato alla creazione automatica della cartella Drive di progetto.

**Da:** `{anno} - {nome cliente} - {nome progetto}`
**A:** `{anno} | {numero preventivo} - {nome progetto}`

### Modifiche

**1. `src/components/ProjectDriveFolderSelector.tsx`**
- Aggiungere prop opzionale `quoteNumber?: string | null`.
- In `handleAutoCreate` sostituire:
  ```ts
  const folderName = `${year} - ${clientName || 'Cliente'} - ${projectName || 'Progetto'}`;
  ```
  con:
  ```ts
  const qn = quoteNumber?.trim();
  const folderName = qn
    ? `${year} | ${qn} - ${projectName?.trim() || 'Progetto'}`
    : `${year} - ${projectName?.trim() || 'Progetto'}`;
  ```
  (fallback senza `|` se manca il numero preventivo, per non lasciare separatori vuoti)

**2. `src/pages/ProjectCanvas.tsx`**
- Passare `quoteNumber={(project as any).manual_quote_number || project.quote_number}` al componente `<ProjectDriveFolderSelector />`.

### Note
- Nessuna modifica al backend / edge function `google-drive-folders`.
- Le cartelle Drive già create non vengono rinominate: solo le nuove avranno questo formato.