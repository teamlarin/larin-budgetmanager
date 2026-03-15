

# Piano: Miglioramento Tab "Il mio Team" (TeamLeader Dashboard)

## Cosa cambia

### 1. Rimuovere elementi ridondanti
- **WorkloadSummaryWidget** (righe 313-324): duplica il "Carico di lavoro team" già presente sotto
- **Bar chart "Ore per membro"** (righe 330-350): stesse info del widget workload detail
- **Bar chart "Avanzamento Progetti"** (righe 352-370): ridondante con la lista "Progetti del Team"
- **Import recharts** (`BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, RadialBarChart, RadialBar`) e `ChartContainer/ChartTooltip`
- Costanti inutilizzate: `COLORS`, `chartConfig`, `completionData`, `workloadChartData`, `projectProgressData`

### 2. Aggiungere: Widget "Situazioni critiche"
Posizionato subito dopo le 4 stats cards (prima del calendario). Card con bordo destructive, visibile solo se ci sono alert. Due sezioni:

- **Progetti a rischio**: da `projectsNearDeadline` già disponibile, filtrati con `progress < 80%` e scadenza entro 7 giorni. Mostra nome, cliente, progresso, giorni rimanenti. Cliccabile verso canvas.
- **Membri sovraccarichi**: dal `teamWorkload`, quelli con `utilization >= 120%`. Mostra nome, % carico, ore eccesso.

Nessuna nuova query necessaria — i dati sono già nelle props.

### 3. Aggiungere: Quick Actions
Riga di bottoni dopo le stats cards (prima degli alert):
- "Vai al Calendario" → `/calendar`
- "Vedi tutti i Progetti" → `/projects`

### 4. Nuovo ordine widget

```text
┌─────────────────────────────────────────┐
│ [4 Stats Cards - invariati]             │
├─────────────────────────────────────────┤
│ Quick Actions (Calendario, Progetti)    │
├─────────────────────────────────────────┤
│ ⚠ Situazioni critiche (se presenti)    │
│   • Progetti a rischio: nome, %, scad. │
│   • Membri sovraccarichi: nome, %      │
├─────────────────────────────────────────┤
│ Calendario settimanale (invariato)      │
├─────────────────────────────────────────┤
│ Progetti in scadenza widget (invariato) │
├─────────────────────────────────────────┤
│ Carico di lavoro team (invariato)       │
├─────────────────────────────────────────┤
│ Progetti del Team (invariato)           │
└─────────────────────────────────────────┘
```

## File da modificare

| File | Modifica |
|------|----------|
| `src/components/dashboards/TeamLeaderDashboard.tsx` | Rimuovere import recharts/ChartContainer/WorkloadSummaryWidget, rimuovere chart data, rimuovere sezione Charts Row, rimuovere WorkloadSummaryWidget render. Aggiungere widget alert critici (calcolato da props esistenti) e Quick Actions |

**Nessuna modifica a `Dashboard.tsx`** — tutti i dati necessari sono già passati come props.

