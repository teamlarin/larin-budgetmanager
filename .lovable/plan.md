

# Piano: Miglioramento Tab Budget & Quote (Account Dashboard)

## Cosa cambia

### 1. Nuovi dati dal query (`Dashboard.tsx`)
La query `accountData` attualmente fetcha i budget ma non espone il breakdown per stato. Serve aggiungere:
- Conteggi per stato: `bozza`, `in_revisione`, `in_attesa`, `approvato`, `rifiutato` (calcolati dai budget già fetchati)
- Lista budget "actionable": rifiutati + in_revisione assegnati all'utente (con nome, cliente, data) per il widget attenzione

### 2. Rimuovere dalla UI (`AccountBudgetQuoteDashboard.tsx`)
- Bar chart "Confronto: I miei vs Totali" (poco operativo)
- Pie chart "Stato Budget" (solo 2 stati, poco utile)
- Pie chart "Stato Preventivi" (solo 2 stati, poco utile)
- Import di `recharts` (PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis) e `ChartContainer`

### 3. Aggiungere: Pipeline Stati Budget
Card con barra orizzontale segmentata che mostra visivamente i 5 stati con conteggi:
```text
[Bozza: 3] [In Revisione: 2] [In Attesa: 5] [Approvato: 8] [Rifiutato: 1]
  grigio       blu              giallo          verde          rosso
```
Ogni segmento è proporzionale, con label e conteggio. Colori coerenti con `BudgetStatusBadge`.

### 4. Aggiungere: Widget "Richiede la tua attenzione"
Card con bordo warning/destructive che lista:
- Budget **rifiutati** (da correggere e ri-sottomettere)
- Budget **in_revisione** (assegnati all'utente, in attesa di azione)
Ogni item mostra nome, cliente, stato badge, ed è cliccabile verso il dettaglio. Se vuoto, la card non viene renderizzata.

### 5. Aggiungere: Quick Actions
Riga di bottoni sotto le stats:
- "Nuovo Budget" → `/budgets` con parametro per aprire creazione
- "Nuovo Preventivo" → `/quotes`
- "Vedi tutti i Budget" → `/budgets`

## File da modificare

| File | Modifica |
|------|----------|
| `src/pages/Dashboard.tsx` | Aggiungere `statusBreakdown` e `actionableBudgets` al return della query account (righe 544-594) |
| `src/components/dashboards/AccountBudgetQuoteDashboard.tsx` | Riscrivere: rimuovere charts, aggiungere pipeline, widget attenzione, quick actions. Aggiornare props interface |

Nessuna modifica al database.

