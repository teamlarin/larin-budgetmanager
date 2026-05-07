# Fix capacità contrattuale nel widget "Carico di lavoro team"

## Problema
Nel widget della dashboard (e nella pagina `/workload`), la capacità settimanale di un utente viene calcolata solo da `profiles.contract_hours` + `contract_hours_period`. Per Giulia Sordi questo restituisce 20h (valore base del profilo), ma per maggio esiste un record in `user_contract_periods` con 30h che dovrebbe prevalere.

Le altre viste (`ProfileHoursBank`, `UserHoursSummary`) applicano già l'override; widget e pagina Workload no.

## Modifiche

### 1. `src/components/dashboards/WorkloadSummaryWidget.tsx`
- Caricare in parallelo i record da `user_contract_periods` (`user_id, start_date, end_date, contract_hours, contract_hours_period`) per gli utenti coinvolti.
- Costruire un helper `getEffectiveContract(userId, weekStart, weekEnd)` che:
  - Cerca un periodo che si sovrappone alla settimana corrente (`start_date <= weekEnd && (end_date IS NULL || end_date >= weekStart)`).
  - Se trovato, ritorna `{ hours, period }` di quel periodo, altrimenti il fallback dal profilo.
  - Se più periodi si sovrappongono, prende quello con `start_date` più recente.
- Usare il contratto effettivo dentro `calculateCapacity(...)` per popolare `capacityHours`.

### 2. `src/pages/Workload.tsx`
- Stessa logica: fetch di `user_contract_periods` e applicazione dell'override per la finestra temporale visualizzata, sostituendo l'uso diretto di `user.contract_hours` / `contract_hours_period`.

## Dettagli tecnici
- Una sola query: `supabase.from('user_contract_periods').select('user_id,start_date,end_date,contract_hours,contract_hours_period').in('user_id', userIds)`.
- Nessuna modifica DB o RLS richiesta (la tabella è già letta da altri componenti con gli stessi campi).
- Nessuna modifica UI: cambia solo il valore `capacityHours` mostrato nel widget e nella pagina, e di conseguenza `% Pianificazione`, badge "Sovraccarico/Scarico" e ore libere.

## Verifica
Dopo il fix, per Giulia Sordi nella settimana corrente (maggio) dovrebbe comparire `XX/30h` invece di `XX/20h`.
