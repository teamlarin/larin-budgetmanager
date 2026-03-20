

## Aggiungere sezione "Update Settimanali" alla Dashboard Operations

### Obiettivo
Nuova sezione nella dashboard Operations che mostra gli aggiornamenti di progetto dell'ultima settimana, con roadblock in evidenza e filtro per area.

### Modifica

**File: `src/components/dashboards/AdminOperationsDashboard.tsx`**

1. **Nuova sezione "Aggiornamenti Settimanali"** tra "Progetti" e "Team", con header visivo coerente (barra colorata + titolo)

2. **Query `useQuery`** con chiave `['weekly-progress-updates']`:
   - Carica da `project_progress_updates` gli update degli ultimi 7 giorni (`created_at >= 7 giorni fa`)
   - Join con `projects` per ottenere nome progetto, area, client
   - Join con `profiles` per il nome dell'autore
   - Ordina: prima quelli con `roadblocks_text` non null, poi per data decrescente

3. **Filtro per Area**: una riga di badge/chip cliccabili con le aree (Marketing, Tech, Branding, Sales, Jarvis, Struttura, Interno) usando `AREA_LABELS` e `AREA_COLORS` da `areaColors.ts`. Un chip "Tutte" selezionato di default. Al click filtra gli update per `project.area`.

4. **Contatore in evidenza**: piccola stat card che mostra "X roadblock attivi" in rosso e "Y update totali" questa settimana

5. **Lista update**: ogni riga mostra:
   - Nome progetto (cliccabile, naviga a `/projects/{id}/canvas`)
   - Badge area con colori
   - Autore e data
   - Testo update (troncato)
   - Se ha roadblock: bordo rosso + icona AlertTriangle + testo roadblock in evidenza
   - Badge progresso (es. "75%")

6. **Ordinamento**: roadblock prima, poi per data decrescente

### Dettagli tecnici
- La query usa due chiamate Supabase: una per `project_progress_updates` con filtro data, una per i `projects` correlati (per avere l'area)
- I profili utente vengono risolti in batch come già fatto in `ProjectProgressUpdates.tsx`
- Il filtro area è client-side sui risultati già caricati
- Usa `useNavigate` già presente nel componente per la navigazione ai progetti

