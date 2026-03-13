

# Riprogettazione tab "Report & Analytics" del Project Canvas

## Analisi della situazione attuale

La tab è composta da:
1. **4 card in griglia 2x2**: Informazioni Progetto, Team, Progresso, Metriche finanziarie
2. **ProjectBudgetStats** sotto, con: alert, grafico consumo, card consumo/forecast, breakdown per categoria e utente

### Problemi identificati
- **Nessuna gerarchia visiva**: tutte le informazioni hanno lo stesso peso. Il project leader deve scorrere per trovare le metriche critiche.
- **Ridondanza**: "Metriche finanziarie" (budget, margine, tipologia) duplica informazioni già in ProjectBudgetStats.
- **Dati di riferimento e dati operativi mescolati**: cliente, disciplina, obiettivo sono dati statici; progresso, budget, scadenza sono dati operativi da monitorare attivamente.
- **Manca un colpo d'occhio**: non c'è un pannello riassuntivo con i KPI chiave.

## Proposta di miglioramento

### 1. KPI Summary Bar (nuova sezione in cima)
Quattro stat-card compatte in riga, con icone e colorazione condizionale:

```text
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Progresso    │  │ Margine      │  │ Scadenza     │  │ Budget       │
│ 65%          │  │ 28.5%        │  │ 23 gg        │  │ €12.400      │
│ ██████░░░░   │  │ obiettivo 30%│  │ entro 15 apr │  │ rimanente    │
└──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘
```

- **Progresso**: barra + percentuale, badge "In chiusura" se ≥85%
- **Margine residuo**: colorato rosso se sotto obiettivo, verde se ok
- **Scadenza**: giorni rimanenti, rosso se ≤7gg, warning se ≤14gg
- **Budget rimanente**: importo rimanente al target, colore condizionale

### 2. Riorganizzazione del layout in due sezioni

**Sezione A — Dati operativi (prominente)**
La griglia 2 colonne diventa:
- **Colonna sx**: Card "Progresso & Timeline" (progress bar, date inizio/fine, stato progetto, giorni rimanenti) — tutto in una card
- **Colonna dx**: Card "Metriche finanziarie" (consolidata — budget attività, target, margine obiettivo, costi sostenuti, tipologia, fatturabile) — fonde le due card attuali ed elimina duplicazione con ProjectBudgetStats

**Sezione B — Dati di contesto (collapsible)**
Card singola "Progetto & Team" con layout orizzontale compatto:
- Info progetto a sinistra (cliente, contatto, quote number, disciplina, obiettivo)
- Team a destra (leader, account, membri, area)
- Collapsible (aperta di default ma riducibile) per dare spazio alle metriche operative

### 3. ProjectBudgetStats rimane sotto invariato
Alert, grafico, consumption/forecast, breakdown — già ben strutturato, non serve toccarlo.

## Dettagli tecnici

### File da modificare
| File | Modifica |
|------|----------|
| `src/pages/ProjectCanvas.tsx` | Ristrutturare il contenuto di `TabsContent value="report"`: aggiungere KPI bar, riorganizzare le 4 card in 2 sezioni, rendere "Progetto & Team" collapsible |

### Dati necessari
Tutti i dati sono già disponibili nel componente (`project`, `currentUserData`). Per il margine residuo si può invocare `calculate-project-margins` (già usato nel `saveField` per completamento) oppure calcolarlo inline con i dati di ProjectBudgetStats. Per semplicità e coerenza, i KPI in cima useranno i dati del progetto direttamente (progress, end_date, margin_percentage, total_budget) senza query aggiuntive. Il margine residuo preciso verrà comunque mostrato nella sezione ProjectBudgetStats sotto.

### Componenti riutilizzati
- `Card` con variant `stats` per i KPI
- `Progress` per le barre
- `Collapsible` di Radix per la sezione Progetto & Team
- `Badge` per indicatori di stato
- `EditableField` interno — invariato, riposizionato

