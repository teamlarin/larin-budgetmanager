## Obiettivo
Aggiungere su ogni KPI card iniziale della HR Budget Dashboard un indicatore di confronto con l'anno precedente (es. `+4,2%` verde o `-1,8%` rosso, con valore assoluto a tooltip).

## Cosa cambia

Solo `src/components/dashboards/HrBudgetDashboard.tsx` (frontend, nessuna modifica a dati o RLS).

### 1. Nuovo memo `kpisPrev`
Stesso calcolo di `kpis` ma su `year - 1`, riusando l'intero dataset `employees` e applicando gli stessi filtri (search/team/contratto/pianificati/cessati) per coerenza. I cessati contribuiscono già fino a `data_fine` grazie a `calcEmployee`.

### 2. Helper `Delta`
Piccolo componente inline che riceve `current` e `previous` numerici e renderizza:
- `▲ +X,X%` in `text-emerald-600` se > 0
- `▼ -X,X%` in `text-rose-600` se < 0
- `=` in `text-muted-foreground` se invariato
- `n/d` se `previous` è 0/null (evita divisione per zero)
- tooltip nativo con valore assoluto anno precedente formattato (€ o numero)

### 3. Estendere `KpiCard`
Aggiungere prop opzionale `delta?: ReactNode` mostrata sotto a `sub`, allineata a destra in piccolo.

### 4. Mappatura per ogni card
| Card | Metrica confronto |
|------|------------------|
| Costo effettivo | `totalActual` |
| Persone attive | `uniqueInCarica.length` |
| RAL media dip. | `avgRalDip` |
| Costo mens. medio dip. | `avgMensDip` |
| Costo mens. medio P.IVA | `avgMensPiva` |
| Anzianità media dip. | `avgAnzDip` (delta in anni, non %) |
| Anzianità media P.IVA | `avgAnzPiva` (delta in anni) |
| Età media | `avgAge` (delta in anni) |
| Distribuzione sesso | delta in punti % su quota M |

Per le metriche in anni: mostro `+0.4 anni` invece di percentuale.
Per "Costo effettivo": confronto sempre full-year vs full-year (il precedente è chiuso, l'anno corrente potrebbe essere parziale → resta confronto significativo solo a fine anno, lo annotiamo nel tooltip "anno in corso").

### Note tecniche
- Nessuna nuova query: i dati storici sono già presenti in `employees` perché `calcEmployee(e, year-1)` ricalcola sui contratti esistenti.
- Se per `year - 1 < YEARS[0]` il delta viene omesso.
- Zero impatto su CSV, tabella, pivot.
