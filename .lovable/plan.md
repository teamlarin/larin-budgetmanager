

# Miglioramenti tab "Update"

## Analisi stato attuale

La tab funziona ma è basilare: una lista piatta di card con nome utente, badge percentuale, testo update, roadblocks e data. Manca contesto visivo sull'andamento nel tempo.

## Miglioramenti proposti

### 1. Mini-timeline visiva del progresso
Aggiungere in cima alla tab una barra visiva che mostra l'andamento del progresso nel tempo — una serie di "step" collegati che mostrano come la percentuale è evoluta (es. 0% → 30% → 55% → 80%). Ogni step mostra la data e la percentuale, con colore che indica la variazione (verde se salita, giallo se stabile, rosso se ci sono roadblocks attivi in quell'update).

### 2. Indicatore roadblocks attivi
Se l'ultimo update contiene roadblocks, mostrare un banner di alert in cima ("⚠ Roadblock attivo segnalato il X") per dare visibilità immediata ai problemi aperti senza scorrere la lista.

### 3. Salvataggio update anche solo con percentuale
Attualmente il `ProgressUpdateDialog` salva un record in `project_progress_updates` **solo** se c'è testo (update o roadblocks). Se l'utente cambia solo la percentuale, il record non viene creato e la timeline resta incompleta. Correggere per salvare sempre il record, così ogni variazione di progresso viene tracciata.

### 4. Filtro rapido roadblocks
Aggiungere un toggle "Solo roadblocks" per filtrare e mostrare solo gli update che contengono segnalazioni di blocchi — utile per revisioni rapide dei problemi del progetto.

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/ProjectProgressUpdates.tsx` | Timeline visiva, banner roadblock attivo, filtro roadblocks |
| `src/components/ProgressUpdateDialog.tsx` | Salvare sempre il record (anche solo percentuale) |

