

## Mostrare i dati del contratto attivo nella lista utenti

### Problema
La tabella utenti in Impostazioni mostra i dati contrattuali salvati nel profilo (`profiles.contract_type`, `profiles.contract_hours`, `profiles.contract_hours_period`), che sono statici. Quando un utente ha periodi contrattuali nella tabella `user_contract_periods`, i dati visualizzati dovrebbero riflettere il contratto attivo alla data odierna.

### Intervento

**File: `src/components/UserManagement.tsx`**

1. In `loadUsers()`, dopo aver caricato profili e ruoli, caricare anche tutti i record da `user_contract_periods` con una singola query.

2. Per ogni utente, cercare il contratto attivo oggi: il periodo con `start_date <= oggi` e (`end_date >= oggi` oppure `end_date` nullo), ordinato per `start_date` discendente (priorità al più recente in caso di sovrapposizione).

3. Se esiste un contratto attivo, sovrascrivere i campi `contract_type`, `contract_hours` e `contract_hours_period` dell'oggetto `UserWithRole` con quelli del periodo attivo. In questo modo la tabella, i filtri e l'ordinamento funzionano automaticamente senza modificare il rendering.

### Dettagli tecnici

- Query aggiuntiva in `loadUsers()`:
  ```typescript
  const { data: contractPeriods } = await supabase
    .from('user_contract_periods')
    .select('user_id, start_date, end_date, contract_type, contract_hours, contract_hours_period');
  ```

- Logica di merge nel mapping dei profili:
  ```typescript
  const today = format(new Date(), 'yyyy-MM-dd');
  const activeContract = (contractPeriods || [])
    .filter(cp => cp.user_id === profile.id && cp.start_date <= today && (!cp.end_date || cp.end_date >= today))
    .sort((a, b) => b.start_date.localeCompare(a.start_date))[0];
  
  if (activeContract) {
    user.contract_type = activeContract.contract_type;
    user.contract_hours = activeContract.contract_hours;
    user.contract_hours_period = activeContract.contract_hours_period;
  }
  ```

- Nessuna modifica al template/rendering: le colonne "Contratto" e "Ore" già leggono da `user.contract_type` e `user.contract_hours`.

