

## Importazione dati performance dai file DOCX

### Cosa faremo
Creeremo uno script che inserisce i dati estratti dagli 8 file DOCX nelle tabelle del sistema performance, mappando ogni persona al proprio profilo utente.

### Dati estratti (8 persone)

| Persona | Job Title | Team | TL | Compilazione |
|---|---|---|---|---|
| Jessica Borsoi | Project Manager | Marketing | Alessandro Di Maio | Q4 2025 |
| Simona Chiofalo | Social media & Copywriter | Marketing | Alessandro Di Maio | Q4 2025 |
| Alessia Da Deppo | Brand & Digital Designer | Marketing | Alessandro Di Maio | Q4 2025 |
| Francesco Ferrari | Marketing Automation | Marketing | Alessandro Di Maio | Q4 2025 |
| Deborah Graziani | Social media & Content | Marketing | Alessandro Di Maio | Q4 2025 |
| Beatrice Mazza | (vuoto nel doc) | Marketing | Alessandro Di Maio | Q4 2025 |
| Stefano Michelis | Performance Specialist | Marketing | Alessandro Di Maio | Q4 2025 |
| Lorenzo Rossi | Content Manager / Specialist | Marketing | Alessandro Di Maio | Q4 2025 |

### Mappatura dati → tabelle

**1. `performance_profiles`** (upsert per user_id):
- `job_title`, `team`, `team_leader_name` — dalla sezione "Dove sei ora"
- `start_date` — dalla sezione "Percorso in azienda"
- `contract_history` — storico variazioni + bonus
- `compensation` — RAL/Compenso + dettagli contratto (CCNL, livello, buoni pasto, fringe, welfare, budget formazione)
- `contract_type` — tipo contratto (P.IVA, indeterminato, etc.)
- `career_target_role` — "Il percorso...punta a portarti verso il ruolo di"
- `career_long_term_goal` — "L'obiettivo di lungo termine"
- `company_support` — "Per supportare questa crescita, Larin"

**2. `performance_reviews`** (insert, anno 2026):
- `year`: 2026
- `compilation_period`: "Q4 2025"
- `strengths`: punti di forza
- `improvement_areas`: aree di miglioramento

**3. `performance_objectives`** (insert, collegati alla review):
- `title`: nome obiettivo
- `description`: risultati attesi/chiave
- `bonus_percentage`: peso %

### Implementazione

1. Scrivere uno script Node.js/Python che usa il client Supabase per:
   - Cercare ogni utente per nome (`full_name` o `first_name`+`last_name`) nella tabella `profiles`
   - Upsert `performance_profiles` con i dati di percorso e sviluppo professionale
   - Insert `performance_reviews` (anno 2026) con punti di forza e aree di miglioramento
   - Insert `performance_objectives` collegati alla review appena creata

2. Lo script gestirà i casi in cui l'utente non viene trovato, loggando un warning

### Note
- I campi `compensation` e `contract_history` conterranno il testo formattato completo (RAL, CCNL, livello, buoni pasto, etc.) per preservare tutti i dettagli dei DOCX
- Gli obiettivi verranno inseriti con `sort_order` progressivo
- Lo script verrà eseguito una tantum, non modificherà il codice dell'app

