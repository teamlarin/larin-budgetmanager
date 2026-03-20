

## Redesign "Carico di lavoro team" con navigazione settimanale

### Situazione attuale
Il `WorkloadSummaryWidget` mostra dati aggregati sul periodo selezionato dal filtro globale della dashboard, con grafici a barre orizzontali poco leggibili che mostrano solo gli utenti "critici" (≥95%). Non c'è navigazione settimanale dedicata.

### Piano

**File: `src/components/dashboards/WorkloadSummaryWidget.tsx`** — Riscrittura completa

1. Aggiungere stato locale `weekOffset` con pulsanti Precedente/Successivo e label "Settimana del {data}"
2. Calcolare `weekStart`/`weekEnd` in base all'offset
3. Query dedicata (`useQuery`) che carica i dati di `activity_time_tracking` + `profiles` per la settimana selezionata, calcolando per ogni utente (escludendo area struttura/sales):
   - Ore pianificate (da `scheduled_start_time`/`scheduled_end_time`)
   - Ore confermate (da `actual_start_time`/`actual_end_time`)
   - Capacità settimanale (da `contract_hours` / `contract_hours_period`)
   - Percentuale di utilizzo
4. Rimuovere i grafici a barre Recharts, sostituire con una **lista compatta** di tutti gli utenti, ordinati per utilizzo decrescente, con:
   - Nome e titolo/area
   - Barra di progresso visiva (ore pianificate vs capacità)
   - Colori semantici: **rosso** se utilizzo > 100% (sovraccarico), **ambra** se 80-100%, **grigio/verde** se < 50% (scarico)
   - Badge "Sovraccarico" o "Scarico" per evidenziare situazioni estreme
   - Ore pianificate, confermate e capacità come valori numerici
5. Mantenere le stat cards riassuntive in alto (utenti, totale pianificate, confermate, sovraccarichi)
6. Alert per utenti sovraccarichi mantenuto

**File: `src/components/dashboards/AdminOperationsDashboard.tsx`** — Minore

- Rimuovere il passaggio di `data` e `isLoading` come props a `WorkloadSummaryWidget` (il widget ora fa la propria query)
- Passare solo un eventuale prop per il periodo di riferimento iniziale

**File: `src/pages/Dashboard.tsx`** — Minore

- La query `admin-team-workload` può essere rimossa o semplificata dato che il widget gestisce i propri dati internamente

### Dettagli tecnici
- La query interna al widget usa `useQuery` con chiave basata su `weekOffset`
- Capacità settimanale: `contract_hours` quando period è `weekly`, `contract_hours / 4` se monthly, `contract_hours * 5` se daily
- Soglie: > 100% = sovraccarico (rosso), < 50% = scarico (blu/grigio con label)
- Il pulsante "Oggi" resetta l'offset a 0

