

## Separare Percorso e Sviluppo Professionale dalla scheda annuale

### Problema
I campi "Percorso Professionale" (ruolo, team, team leader, data inizio, contratto, compenso, storico) e "Sviluppo Professionale" (ruolo obiettivo, obiettivo lungo termine, supporto azienda) sono attualmente dentro la scheda annuale, ma non cambiano ogni anno. Vanno gestiti come dati a livello utente, non a livello di review.

### Soluzione

**Nuova tabella `performance_profiles`** (1 riga per utente):

| Colonna | Tipo | Note |
|---|---|---|
| id | uuid PK | |
| user_id | uuid UNIQUE | riferimento utente |
| job_title | text | precompilato da profiles.title |
| team | text | precompilato da profiles.area |
| team_leader_name | text | precompilato da team_leader_areas |
| start_date | date | |
| contract_type | text | |
| compensation | text | |
| contract_history | text | |
| career_target_role | text | |
| career_long_term_goal | text | |
| company_support | text | |

RLS: stesse policy delle performance_reviews (utente vede i propri, TL vede la sua area, admin vede tutto).

### Modifiche UI in `PerformanceReviewManagement.tsx`

1. **Nuova sezione fissa** sopra la lista schede annuali: due card read-only "Percorso Professionale" e "Sviluppo Professionale" che mostrano i dati da `performance_profiles` con un bottone "Modifica" che apre un dialog dedicato
2. **Rimuovere** questi campi dal dialog di creazione/modifica scheda annuale (restano solo: anno, periodo compilazione, punti di forza, aree di miglioramento)
3. **Rimuovere** la tab "Scheda" dal pannello dettaglio annuale (quei dati sono ora nella sezione fissa sopra)
4. La precompilazione automatica (ruolo, team, TL dal profilo) avviene alla creazione del `performance_profiles`, non della review annuale

### Modifiche in `PerformanceReviewTab.tsx` (vista utente)

- La sezione "Percorso Professionale" e "Sviluppo Professionale" vengono caricate da `performance_profiles` anziché dalla review selezionata
- Restano visibili indipendentemente dall'anno selezionato

### Migrazione dati

- Nella migration SQL, copiare i dati esistenti dalla review più recente di ogni utente nella nuova tabella `performance_profiles`
- Le colonne nella tabella `performance_reviews` non vengono droppate subito (backward compatibility), ma il codice non le usa più

