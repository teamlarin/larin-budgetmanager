

# Piano: Miglioramento Tab Admin Operations + Finance

## Panoramica

Due interventi distinti sulle tab Admin della dashboard:

1. **Operations**: Aggiunta widget "Alert Critici" con progetti a rischio e utenti sovraccarichi
2. **Finance**: Rifacimento completo con pipeline stati budget, widget actionable (budget da approvare), KPI economici reali, rimozione pie chart

---

## 1. Operations — Widget Alert Critici

### Cosa aggiungere

Un widget "Situazioni critiche" sotto le 4 card stats e prima del workload, che mostra:

- **Progetti a rischio scadenza**: progetti aperti con end_date entro 7 giorni e progresso < 80% (esclusi interno/consumptive)
- **Utenti sovraccarichi**: dal `teamWorkload` già disponibile, quelli con `utilizationPercentage >= 120%`

Se non ci sono alert, il widget non viene renderizzato.

### Dati necessari

I progetti a rischio li ricaviamo da `allProjects` già fetchati nella query `adminStats` — basta filtrarli e passarli come nuovo campo `criticalProjects`. Il workload sovraccarico si filtra dal `teamWorkload` già passato.

### File da modificare

| File | Modifica |
|------|----------|
| `Dashboard.tsx` | Aggiungere `criticalProjects` al return della query adminStats (filtro: open, scadenza ≤7gg, progresso <80%, esclusi interno/consumptive) |
| `AdminOperationsDashboard.tsx` | Aggiungere prop `criticalProjects`, renderizzare widget alert con card bordo destructive, link ai progetti |

---

## 2. Finance — Rifacimento completo

### Cosa rimuovere
- Entrambi i PieChart (stato budget e stato progetti)
- Import di recharts e ChartContainer

### Cosa aggiungere

**a) Pipeline Stati Budget** (stessa struttura del componente Account)
- Barra segmentata con i 5 stati (bozza, in_revisione, in_attesa, approvato, rifiutato) con conteggi e colori coerenti
- Richiede `statusBreakdown` calcolato dai budget fetchati

**b) Widget "Budget da approvare"** 
- Card con lista budget in stato `in_attesa` e `in_revisione`, cliccabili verso il dettaglio
- L'Admin deve vedere TUTTI i budget actionable, non solo i propri

**c) KPI Economici**
- **Valore approvato vs totale**: rapporto tra budget approvati e totale
- **Tasso di conversione**: % budget approvati su totale
- **Valore medio budget**: media dei budget approvati
- Questi KPI sostituiscono la card "Progetti in scadenza" (duplicata con Operations)

**d) Quick Actions**
- "Vedi tutti i Budget" → navigazione

### Dati necessari

La query `adminStats` già fetcha i budget ma solo conteggi e budget approvati. Serve estenderla per:
- Fetchare tutti i budget con `id, name, status, total_budget, created_at, client_id` + join clients(name)
- Calcolare `statusBreakdown` (conteggi per stato)
- Filtrare `actionableBudgets` (in_attesa + in_revisione)
- Calcolare KPI: tasso conversione, valore medio

### File da modificare

| File | Modifica |
|------|----------|
| `Dashboard.tsx` | Estendere query adminStats: fetchare budget con dettaglio, calcolare statusBreakdown, actionableBudgets, KPI. Passare nuove props a AdminFinanceDashboard |
| `AdminFinanceDashboard.tsx` | Riscrivere: nuova interface props, pipeline stati, widget actionable, KPI cards, quick actions. Rimuovere recharts |

---

## Struttura risultante

```text
TAB OPERATIONS:
┌─────────────────────────────────────────┐
│ [4 Stats Cards - invariati]             │
├─────────────────────────────────────────┤
│ ⚠ Situazioni critiche (se presenti)    │
│   • Progetti a rischio: nome, %, scad. │
│   • Utenti sovraccarichi: nome, %      │
├─────────────────────────────────────────┤
│ [Workload Widget - invariato]           │
└─────────────────────────────────────────┘

TAB FINANCE:
┌─────────────────────────────────────────┐
│ [4 Stats Cards: Budget, Preventivi,     │
│  Valore approvato, Tasso conversione]   │
├─────────────────────────────────────────┤
│ Pipeline Stati Budget (barra segmentata)│
├─────────────────────────────────────────┤
│ ⚠ Budget da approvare (actionable)     │
├─────────────────────────────────────────┤
│ Quick Actions                           │
└─────────────────────────────────────────┘
```

## Riepilogo file

| File | Tipo |
|------|------|
| `src/pages/Dashboard.tsx` | Modifica query adminStats |
| `src/components/dashboards/AdminOperationsDashboard.tsx` | Aggiunta widget alert critici |
| `src/components/dashboards/AdminFinanceDashboard.tsx` | Riscrittura completa |

Nessuna modifica al database.

