

## Filtrare "Assegnato a" per ruolo

### Problema
I dropdown "Assegnato a" in `Index.tsx` (lista budget) e `ProjectBudget.tsx` (dettaglio budget) caricano tutti i profili approvati. Devono mostrare solo utenti con ruolo admin, team_leader, account o coordinator.

### Modifiche tecniche

**1. `src/pages/Index.tsx`** (~riga 120-124)
Sostituire la query profili:
```typescript
// Prima:
const { data: usersData } = await supabase
  .from('profiles')
  .select('id, first_name, last_name, email')
  .eq('approved', true)
  .order('first_name');

// Dopo:
const { data: usersData } = await supabase
  .from('profiles')
  .select('id, first_name, last_name, email, user_roles!inner(role)')
  .eq('approved', true)
  .is('deleted_at', null)
  .in('user_roles.role', ['admin', 'team_leader', 'account', 'coordinator'])
  .order('first_name');
```

**2. `src/pages/ProjectBudget.tsx`** (~riga 189-193)
Stessa modifica alla query profili per il dropdown "Assegnato a" nel dettaglio budget.

Nessuna modifica al rendering — i dropdown usano già `users.map(...)` che continuerà a funzionare con i dati filtrati.

