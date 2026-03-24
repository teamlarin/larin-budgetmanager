

## Ristrutturare la tab "Progetti" del Team Leader

### Problema attuale
La tab "Progetti" del team leader mostra KPI generiche e un elenco di tutti i progetti, senza roadblock attivi ne aggiornamenti settimanali. Queste informazioni sono piu utili per il team leader rispetto alla lista completa dei progetti.

### Soluzione

Sostituire il contenuto della `TeamLeaderProjectsSection` con:

1. **KPI card** (mantenere le 4 esistenti: progetti aperti, in partenza, budget totale, da fatturare)
2. **Roadblock attivi** — card dedicata con i roadblock segnalati nell'ultima settimana, filtrati per le aree del team leader
3. **Aggiornamenti settimanali** — lista degli aggiornamenti degli ultimi 7 giorni, filtrati per area
4. **Progetti senza aggiornamenti** — lista progetti "stale" (>7 giorni senza update)
5. **Progetti a rischio scadenza** — mantenere la sezione critica esistente
6. **Rimuovere** l'elenco completo "Progetti del Team" (non serve, c'e gia la pagina Progetti)

### Implementazione — `src/components/dashboards/TeamLeaderDashboard.tsx`

Nella `TeamLeaderProjectsSection`:

- Aggiungere una prop `leaderAreas?: string[]` per filtrare per area
- Riutilizzare il `WeeklyUpdatesWidget` che gia esiste e contiene tutta la logica (roadblock, aggiornamenti, stale projects, filtro area). Pero questo widget non accetta un filtro area pre-impostato dall'esterno.

**Approccio**: Aggiungere una prop opzionale `filterAreas?: string[]` al `WeeklyUpdatesWidget` per filtrare automaticamente i dati per le aree del team leader. Quando impostata, mostra solo i dati di quelle aree (senza il selettore area manuale, o con il selettore limitato a quelle aree).

### Modifiche per file

**`src/components/dashboards/WeeklyUpdatesWidget.tsx`**:
- Aggiungere prop `filterAreas?: string[]`
- Se impostata, filtrare updates e staleProjects per quelle aree
- Limitare i badge area nel filtro a quelle aree

**`src/components/dashboards/TeamLeaderDashboard.tsx`** — `TeamLeaderProjectsSection`:
- Aggiungere prop `leaderAreas` all'interfaccia
- Mantenere le 4 KPI card in cima
- Mantenere la sezione "Progetti a rischio scadenza"
- Sostituire la card "Progetti del Team" con `<WeeklyUpdatesWidget filterAreas={leaderAreas} />`

**`src/pages/Dashboard.tsx`**:
- Passare le aree del team leader a `TeamLeaderProjectsSection` tramite la prop `leaderAreas`
- Le aree sono gia disponibili nei dati del team leader (dal profilo o dalle team_leader_areas)

### Altre informazioni utili da aggiungere

Aggiungere nella `TeamLeaderProjectsSection`, tra le KPI e i roadblock:
- **Card "Progetti in chiusura"**: count dei progetti con progresso >= 85%, utile per sapere quali stanno per completarsi

### File coinvolti
- `src/components/dashboards/WeeklyUpdatesWidget.tsx`
- `src/components/dashboards/TeamLeaderDashboard.tsx`
- `src/pages/Dashboard.tsx`

