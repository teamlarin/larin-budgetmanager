

## Mostrare il costo orario dal contratto attivo nella lista utenti

### Problema
Il codice aggiunto in precedenza per sovrascrivere i dati del contratto attivo non include il campo `hourly_rate`. La tabella `user_contract_periods` ha la colonna `hourly_rate`, ma la riga 321-325 di `UserManagement.tsx` sovrascrive solo `contract_type`, `contract_hours` e `contract_hours_period`.

### Intervento

**File: `src/components/UserManagement.tsx`** (unico file, una riga)

Aggiungere `user.hourly_rate = activeContract.hourly_rate;` nel blocco `if (activeContract)` (dopo riga 324), e assicurarsi che la query `contractPeriods` includa già `hourly_rate` nella select.

