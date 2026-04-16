

## Fix: Riallineare account progetti di Elena Susana

### Problema
Elena Susana ha ancora 43 progetti come account. Di questi:
- **13** → dovrebbero andare a **Alberto Nalin**
- **9** → dovrebbero andare a **Michele Da Rold**
- **8** → dovrebbero andare a **Sofia Baudino**
- **13** → clienti senza account assegnato (restano invariati)

La migrazione precedente non ha aggiornato questi record (probabilmente il trigger di audit ha bloccato l'UPDATE sui progetti come ha fatto coi budget).

### Implementazione

Rieseguire l'UPDATE sui progetti disabilitando temporaneamente eventuali trigger problematici:

```sql
UPDATE projects p
SET account_user_id = c.account_user_id
FROM clients c
WHERE p.client_id = c.id
  AND c.account_user_id IS NOT NULL
  AND p.account_user_id IS DISTINCT FROM c.account_user_id;
```

Anche per i budget, verificare e correggere eventuali residui.

### Note
- I 13 progetti su clienti senza account restano con Elena (nessuna forzatura a NULL)
- Operazione una tantum via insert tool

