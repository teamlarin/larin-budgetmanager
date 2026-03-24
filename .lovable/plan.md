

## Gestione ore progetto "Larin OFF" nella banca ore

### Obiettivo
Per i **dipendenti** (full-time/part-time):
- Le ore confermate su attività "permesso", "malattia", "donazione sangue", "ferie" del progetto OFF contano normalmente come ore confermate (quindi coprono le ore previste)
- Le ore confermate sull'attività **"banca ore"** del progetto OFF vanno **sottratte** dal saldo totale (riducono il saldo positivo accumulato)

Per i **freelance/consuntivo**: le ore del progetto OFF non vengono conteggiate affatto (ne' come confermate ne' come previste).

### Logica di identificazione
Il progetto OFF viene identificato cercando progetti il cui nome contiene "OFF" (case-insensitive). L'attività "banca ore" viene identificata dal nome dell'attività (budget_item.activity_name) contenente "banca ore" (case-insensitive).

### Modifiche alle query

Entrambi i file (`UserHoursSummary.tsx` e `ProfileHoursBank.tsx`) devono modificare le query delle ore confermate per includere i dati del progetto e dell'attività:

1. **Query ore confermate**: aggiungere il join `budget_items(activity_name, projects:project_id(name))` per poter identificare il progetto OFF e l'attività "banca ore"
2. **Logica di filtraggio**:
   - Per **freelance/consuntivo**: escludere tutte le ore dei progetti che contengono "OFF" nel nome
   - Per **dipendenti**: le ore delle attività normali (ferie, permessi, malattia, donazione sangue) contano normalmente. Le ore dell'attività "banca ore" vengono tracciate separatamente come `bancaOreHours` e **sottratte** dal saldo

### Dettaglio modifiche

**`src/components/dashboards/UserHoursSummary.tsx`**

1. **Query `user-hours-summary-widget`** (riga ~121): già include `budget_items(project_id, projects:project_id(is_billable))` — estendere per includere `activity_name` e `projects.name`
2. **Query `user-hours-ytd`** (riga ~190): aggiungere `budget_items(activity_name, projects:project_id(name))` per poter filtrare
3. **Aggregazione**: nel loop di aggregazione, per ogni entry:
   - Determinare se il progetto è un progetto OFF (`project_name.includes('OFF')`)
   - Se l'utente è freelance/consuntivo: saltare l'entry
   - Se è un dipendente e l'attività è "banca ore": accumulare in un campo separato `bancaOre`
   - Altrimenti: accumulare normalmente
4. **Calcolo saldo**: `ytdBalance = ytdConfirmed - ytdExpected + carryover - bancaOreHours`
5. **UI**: aggiungere una colonna o indicazione per le ore di banca ore utilizzate

**`src/components/ProfileHoursBank.tsx`**

1. **Query `profile-hours-bank-ytd`** (riga ~161): aggiungere join con `budget_items` per ottenere nome progetto e attività
2. **Stessa logica di filtraggio**: determinare il tipo contratto dell'utente, escludere o separare le ore "banca ore"
3. **Visualizzazione**: mostrare nella tabella mensile e nel saldo anno le ore di banca ore utilizzate

### Nessuna modifica al database
Tutto è basato su dati esistenti (nomi progetto e attività). Non servono migrazioni.

### File modificati
- `src/components/dashboards/UserHoursSummary.tsx`
- `src/components/ProfileHoursBank.tsx`

