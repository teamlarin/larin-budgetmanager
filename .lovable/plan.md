

## Aggiornamento account su progetti e budget in base ai clienti

### Cosa faremo

Per ogni cliente che ha un `account_user_id` impostato, allineeremo lo stesso valore su tutti i **progetti** e **budget** collegati a quel cliente.

### Impatto

- **39 progetti** da aggiornare
- **6 budget** da aggiornare
- I clienti senza account (`account_user_id IS NULL`) verranno ignorati

### Implementazione

Due query UPDATE eseguite tramite il tool di insert:

```sql
-- 1. Aggiorna account_user_id nei progetti
UPDATE projects p
SET account_user_id = c.account_user_id
FROM clients c
WHERE p.client_id = c.id
  AND c.account_user_id IS NOT NULL
  AND p.account_user_id IS DISTINCT FROM c.account_user_id;

-- 2. Aggiorna account_user_id nei budget
UPDATE budgets b
SET account_user_id = c.account_user_id
FROM clients c
WHERE b.client_id = c.id
  AND c.account_user_id IS NOT NULL
  AND b.account_user_id IS DISTINCT FROM c.account_user_id;
```

### Note
- Nessuna modifica allo schema DB o al codice dell'app
- Operazione una tantum di allineamento dati

