

## Aggiungere colonna "Saldo Anno" al Riepilogo Ore Team

### Obiettivo
Mostrare per ogni utente il saldo cumulativo (ore confermate - ore previste) dall'inizio dell'anno corrente fino al mese selezionato, così da avere una visione complessiva dell'andamento annuale.

### Modifica

**File: `src/components/dashboards/UserHoursSummary.tsx`**

1. **Nuova query `useQuery`** con chiave `['user-hours-ytd', year]` che carica le ore confermate da gennaio fino alla fine del mese selezionato (Year-To-Date):
   - Range: `{anno}-01-01` → fine del mese selezionato
   - Stessa logica di paginazione e calcolo ore della query esistente
   - Restituisce una mappa `userId → totalHoursYTD`

2. **Calcolo ore previste YTD**: per ogni mese da gennaio al mese selezionato, calcolare le ore previste usando la stessa logica contrattuale (`contract_hours` per monthly, `* workingDays` per daily, ecc.). Serve calcolare i giorni lavorativi per ogni mese dell'intervallo, usando le stesse closure days.

3. **Nuova colonna "Saldo Anno"** nella tabella, dopo "Saldo" (mensile):
   - Valore = `ytdConfirmed - ytdExpected`
   - Stessa formattazione colori: verde con `+` se positivo, rosso se negativo
   - Header: `Saldo Anno`

4. **Stat card aggiuntiva** nel riepilogo in alto: "Saldo Anno" complessivo del team

### Dettagli tecnici
- Per evitare troppe query, la query YTD carica tutte le time entries da inizio anno fino al mese selezionato in un'unica chiamata
- Le ore previste YTD si calcolano iterando su ogni mese da gennaio al mese selezionato, calcolando i giorni lavorativi di ciascun mese (usando le closure days già caricate) e applicando la formula contrattuale
- La query YTD viene ricalcolata quando cambia il mese selezionato (cambia il range)

