

## Ristrutturazione dashboard "Il mio Team" per Team Leader

### Cosa c'è ora (problemi)
La tab mostra dati generici e ridondanti:
- 4 KPI poco utili (membri, progetti attivi, ore pianificate, ore confermate)
- Azioni rapide ridondanti con la navbar
- Calendario settimanale duplicato (già presente in "Il mio Recap")
- Lista progetti senza dati economici (budget, fatturato)
- Nessuna visione economica del portafoglio

### Cosa faremo: due sezioni chiare

#### Sezione 1: Team (Persone)
| KPI | Descrizione |
|-----|-------------|
| Membri team | Conteggio |
| Utilizzo medio | % media planned/capacity |
| Ore disponibili | Somma ore libere del team |

+ Alert solo per **membri sovraccarichi** (≥120%)
+ Tabella carico di lavoro (già esistente, mantenuta)

#### Sezione 2: Progetti & Economia
| KPI | Descrizione |
|-----|-------------|
| Progetti aperti | Count status = `aperto` |
| Progetti in partenza | Count status = `in_partenza` |
| Budget totale | Somma `total_budget` dei progetti aperti/in_partenza |
| Da fatturare | Count status = `da_fatturare` |

+ Alert solo per **progetti a rischio scadenza** (≤7gg, progress <80%)
+ Lista progetti arricchita con: nome, cliente, stato, **budget €**, progresso, scadenza
+ Widget "Progetti in scadenza" (spostato qui)

#### Elementi rimossi
- Calendario settimanale (già in "Il mio Recap")
- Azioni rapide (link a calendario/progetti, ridondanti)

### Modifiche tecniche

**File 1: `src/pages/Dashboard.tsx`** (query dati)
- Aggiungere query per progetti `da_fatturare` nell'area del TL
- Includere `total_budget` e `end_date` nei dati dei progetti passati come props
- Calcolare e passare nuove props: `totalBudgetValue`, `projectsToInvoice`, `startingProjects`
- Passare lista completa progetti (non solo primi 5) con dati budget
- Rimuovere la query separata `teamLeaderWeeklyCalendar` (non più necessaria)

**File 2: `src/components/dashboards/TeamLeaderDashboard.tsx`** (UI)
- Rimuovere props calendario (`weeklyCalendar`, `weekOffset`, `onWeekChange`, `weekDateRange`)
- Aggiungere nuove props economiche
- Layout a 2 sezioni con titoli/separatori visivi
- Nuovi KPI cards per Team (3) e Progetti (4)
- Alert critici separati per contesto
- Lista progetti con colonna budget (formattata in €) e data scadenza
- Rimuovere blocco calendario settimanale e azioni rapide

