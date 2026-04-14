

## Sezione Performance nel Profilo Utente

### Cosa fa
Aggiunge una nuova tab "Performance" nel profilo utente che contiene le informazioni della scheda personale (percorso professionale, obiettivi, sviluppo, punti di forza/miglioramento, note trimestrali). I dati sono visibili all'utente stesso, agli admin e al team leader di riferimento.

### Struttura dati (3 tabelle)

**`performance_reviews`** - La scheda annuale
| Campo | Tipo | Note |
|-------|------|------|
| id | uuid PK | |
| user_id | uuid FK profiles | Chi viene valutato |
| year | integer | Anno di riferimento |
| compiled_by | uuid FK profiles | Chi ha compilato |
| compilation_period | text | Es. "Q4 2025" |
| job_title | text | Ruolo attuale |
| team | text | Team di appartenenza |
| team_leader_name | text | Nome del TL |
| start_date | date | Data inizio in azienda |
| contract_history | text | Storico variazioni |
| compensation | text | Compenso (cifra) |
| contract_type | text | Tipo contratto |
| career_target_role | text | Ruolo obiettivo |
| career_long_term_goal | text | Obiettivo lungo termine |
| company_support | text | Cosa offre l'azienda |
| strengths | text | Punti di forza |
| improvement_areas | text | Aree di miglioramento |
| created_at / updated_at | timestamp | |

**`performance_objectives`** - Gli obiettivi con % premio
| Campo | Tipo |
|-------|------|
| id | uuid PK |
| review_id | uuid FK performance_reviews |
| title | text |
| description | text (risultati attesi, dettagli) |
| bonus_percentage | numeric |
| sort_order | integer |

**`performance_quarterly_notes`** - Note trimestrali
| Campo | Tipo |
|-------|------|
| id | uuid PK |
| review_id | uuid FK performance_reviews |
| quarter | text (Q1, Q2, Q3, Q4) |
| notes | text |
| created_by | uuid FK profiles |

### RLS
- L'utente vede solo le proprie `performance_reviews`
- Admin vede tutte
- Team leader vede quelle degli utenti nel proprio team (tramite `team_leader_areas` e match sull'area dell'utente)
- Solo admin può inserire/modificare

### UI

1. **Nuova tab "Performance"** nella pagina Profilo (visibile a tutti gli utenti per i propri dati)
2. **Nuova pagina/sezione admin** per gestire le schede degli utenti (creare/modificare review, obiettivi, note trimestrali)
3. La tab mostra:
   - Card "Percorso Professionale" (job title, team, date, contratto)
   - Card "Obiettivi di Performance" (tabella obiettivi con % premio)
   - Card "Sviluppo Professionale" (percorso, ruolo target, supporto azienda)
   - Card "Punti di Forza e Aree di Miglioramento"
   - Card "Confronti Trimestrali" (note per trimestre)

### File coinvolti
- **Migration SQL**: 3 nuove tabelle + RLS policies
- **Nuovo componente**: `src/components/PerformanceReviewTab.tsx` (visualizzazione)
- **Nuovo componente**: `src/components/PerformanceReviewManagement.tsx` (gestione admin)
- **Modifica**: `src/pages/Profile.tsx` - aggiunta tab "Performance"
- **Modifica**: `src/pages/Settings.tsx` - aggiunta tab "Performance" per gestione admin

