

## Nuova tab "HR" nella Dashboard – Costo del Personale

Nuova tab visibile **solo ad admin e finance** che replica la logica del prototipo HTML caricato (calcolo costi del personale per anno e per persona) integrandola con i dati esistenti su `profiles` / `user_contract_periods` ma persistendo i dati specifici HR in una nuova tabella dedicata.

### Architettura dati

**Nuova tabella `hr_employees`** (record-per-contratto, non per-persona, così da gestire variazioni RAL/contratto nel tempo):

| Colonna | Tipo | Note |
|---|---|---|
| id | uuid PK | |
| profile_id | uuid FK → profiles(id) NULL | collegamento opzionale (per esterni o pianificati può essere null) |
| azienda | text | "Larin" / "Mostaza" / altro |
| cognome, nome, job_title, team | text | |
| contratto | text | enum-like: Stage, Apprendista, Impiegato, Dirigente, Amministratore, P.IVA, Rit.Acc. |
| stato | text | "confermato" / "pianificato" |
| ral | numeric | RAL annuale o costo freelance annuale |
| ore_freelance | int | mensili (solo P.IVA / Rit.Acc.) |
| bp_unitario | numeric | buoni pasto €/giorno |
| fringe_annuale | numeric | |
| orario | text | "FT" / "PT" |
| pt_perc | int | percentuale part time |
| data_nascita, data_inizio_collaborazione, data_inizio, data_fine | date | |
| sesso | text | M/F |
| created_at, updated_at, created_by | timestamptz/uuid | |

**RLS**: lettura/scrittura limitata ad admin e finance via `has_role`. Nessuna esposizione ad altri ruoli.

**Migration aggiuntiva**: seed iniziale opzionale dai 60+ record presenti in `INITIAL_DATA` dell'HTML — chiedo conferma se importarli automaticamente o lasciare la tabella vuota e farti caricare manualmente / via CSV.

### UI – nuova tab "HR"

Nuovo file `src/components/dashboards/HrBudgetDashboard.tsx` con tutta la logica del prototipo HTML riportata in React + Tailwind + shadcn/ui (Card, Table, Dialog, Select, Input, Button, Badge), conservando:

- **Selettore anno** (2025-2028, default anno corrente).
- **9 KPI card**: costo effettivo annuale, persone attive (split dipendenti/P.IVA), RAL media dipendenti, costo mensile medio dip., costo mensile medio P.IVA, anzianità media dipendenti, anzianità media P.IVA, età media, distribuzione sesso.
- **Toolbar**: ricerca, filtro team, filtro contratto, toggle "Includi pianificati" / "Mostra cessati", toggle mostra/nascondi colonne mensili, export CSV.
- **Tabella principale** con colonne fisse (sticky) per le prime 4 colonne, sort su tutte le colonne, badge contratto/PT/PLAN/CESSATO/FUTURO, breakdown per mese (12 colonne mostrabili/nascondibili), totale annuale per riga, riga totali in tfoot, azioni duplica/modifica per riga.
- **Pannello "Impatto assunzioni pianificate"** con confronto attuale vs proiezione.
- **Riepilogo costi per team** (barre).
- **Pivot mensile per team** con export CSV dedicato.
- **Modal aggiungi/modifica/duplica persona** con tutti i campi del form HTML, anteprima calcoli live (coefficiente, costo aziendale annuale/mensile, BP, totale mensile/annuale), bottone elimina.

### Logica di calcolo (identica al prototipo)

```text
COEFFICIENTI:
  Stage         1.0  (12 mensilità)
  Apprendista   1.3  (14)
  Impiegato     1.4  (14)
  Dirigente     1.6  (14)
  Amministratore 1.3 (12)
  P.IVA         1.0  (12)
  Rit.Acc.      1.0  (12)

costo_az_annuale  = ral * coeff
costo_az_mensile  = costo_az_annuale / 12
bp_annuali        = bp_unitario * 200
costo_totale_mens = costo_az_mensile + bp_annuali/12 + fringe/12
costo_totale_ann  = costo_az_annuale + bp_annuali + fringe

costo_orario:
  - freelance: costo_az_mensile / ore_freelance
  - dipendente: costo_totale_annuale / (200 * ptFactor * 8)

mese attivo nell'anno: ultimo giorno del mese ∈ [data_inizio, data_fine]
```

### Permessi & visibilità

- In `Dashboard.tsx`, aggiungo la tab "HR" agli oggetti `roleTabs` per `userRole === 'admin'` e `userRole === 'finance'`. La tab viene renderizzata sopra/dopo le tab esistenti.
- Tutte le query e i dialog di modifica sono gated lato UI da `userRole in ('admin','finance')` e lato DB da policy RLS basate su `has_role`.
- I dati HR (RAL, costi, fringe) sono sensibili → nessun accesso da altri ruoli.

### Dettagli tecnici

- File nuovi:
  - `supabase/migrations/<ts>_hr_employees.sql` — tabella + RLS + trigger `updated_at`
  - `src/components/dashboards/HrBudgetDashboard.tsx` — componente principale
  - `src/components/dashboards/HrEmployeeDialog.tsx` — modal CRUD
  - `src/lib/hrCalculations.ts` — funzioni pure (`calcEmployee`, `COEFFICIENTS`, helpers età/anzianità)
- File modificati:
  - `src/pages/Dashboard.tsx` — aggiunta tab `{ label: 'HR', value: 'hr', content: <HrBudgetDashboard /> }` per admin e finance
- Persistenza: `useQuery` + `useMutation` con `react-query` per la tabella HR. Nessuna dipendenza dal localStorage del prototipo.
- Export CSV implementato in JS lato client (download blob).
- Performance: ~60-100 record stimati → nessuna paginazione necessaria, calcoli in-memory.

### Note operative

- **Lascio vuota la tabella** all'inizio: importi tu i dati o me li fai importare a parte (servono come dati sensibili reali, non li metto in seed pubblico).
- L'integrazione con `profiles.id` è opzionale: utile in futuro per collegare HR record → utente loggato (es. costo orario per timesheet), ma per ora non serve modificare nulla del flusso esistente.

### Domanda aperta

Se vuoi che importi automaticamente i ~70 record demo presenti in `INITIAL_DATA` del file HTML (utile come baseline reale), confermami nel prossimo messaggio così aggiungo lo step di seed nella migration. Altrimenti parto con tabella vuota e potrai caricarli da UI uno alla volta o via CSV.

