

## Aprire il ProgressUpdateDialog dalla card progresso KPI

### Contesto
La card "Progresso" nella barra KPI del ProjectCanvas (griglia in alto) mostra la percentuale ma non è cliccabile. Il dialog e lo stato `showProgressDialog` esistono già nel componente.

### Modifica

**File: `src/pages/ProjectCanvas.tsx`** (unico file)

- Aggiungere `onClick={() => setShowProgressDialog(true)}` e `cursor-pointer` alla Card "Progresso" nella KPI Summary Bar (riga ~695)
- Aggiungere un effetto hover visivo per indicare che è cliccabile

La card diventerà cliccabile e aprirà lo stesso `ProgressUpdateDialog` già usato nella sezione "Progresso & Timeline".

