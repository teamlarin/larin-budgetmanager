## Problema

Nella lista progetti (`src/pages/Index.tsx`) i costi confermati vengono calcolati leggendo le tariffe orarie tramite `fetchProfilesCompensation` → RPC `get_profiles_compensation`.

Quella RPC (verificata a DB) restituisce le righe di altri utenti **solo** ad admin, finance e team_leader; agli altri restituisce solo la propria riga.

Cristiano Maretti ha ruolo **coordinator** (verificato in `user_roles`): riceve una mappa tariffe vuota → `userHourlyRate = 0` per tutte le registrazioni → `confirmedCosts = 0` → `residualMargin = 100%` per ogni progetto. Alessandro (admin) vede i valori corretti.

Esiste già la RPC dedicata `get_hourly_rates_for_costing`, che espone **solo** `hourly_rate` a qualunque utente approvato, creata proprio per questi calcoli economici (già usata in `ProjectCanvas.tsx` e `ProjectBudgetStats.tsx`).

## Soluzione

In `src/pages/Index.tsx` (≈ righe 200-203), sostituire:

- `fetchProfilesCompensation(timeTrackingUserIds)` → `fetchHourlyRatesForCosting(timeTrackingUserIds)`
- costruire `profileHourlyRateMap` dalle righe `{ id, hourly_rate }` restituite

Nessun'altra logica di calcolo cambia; nessuna modifica al database.

## Verifica

- Controllare gli altri punti che calcolano marginalità/costi di progetto e usano ancora `fetchProfilesCompensation` per tariffe altrui, per allinearli alla stessa RPC se mostrano dati economici di progetto a ruoli non privilegiati (es. `ProjectActivitiesManager.tsx`).
- Confermare che la marginalità mostrata a un coordinator coincida con quella vista da admin sullo stesso progetto.

## Nota sicurezza

Il cambio non espone dati nuovi: `get_hourly_rates_for_costing` restituisce solo la tariffa oraria (già usata altrove per utenti approvati), mentre tipo di contratto, ore contrattuali e produttività restano riservate a admin/finance/team_leader.
