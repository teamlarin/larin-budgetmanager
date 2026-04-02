

## Filtrare il campo "Account" per ruoli admin e account

### Problema
Il dropdown "Account" in tutti i punti dell'app usa la stessa lista utenti del campo "Assegnato a" (o tutti gli utenti approvati). Deve invece mostrare solo utenti con ruolo `admin` o `account`.

### Modifiche

**1. `src/pages/Index.tsx`**
- Aggiungere una seconda query per `accountUsers` filtrata con `['admin', 'account']`
- Aggiungere stato `accountUsers` separato
- Passare `accountUsers` ai componenti che rendono il dropdown Account (ProjectCard)

**2. `src/pages/ProjectBudget.tsx`**
- Aggiungere query separata `accountUsers` con filtro `['admin', 'account']`
- Usare `accountUsers` nel dropdown Account (riga 580)

**3. `src/components/ProjectCard.tsx`**
- Aggiungere prop `accountUsers` (o fetch separato con filtro ruoli)
- Usare `accountUsers` nel dropdown Account invece di `users`

**4. `src/components/CreateProjectDialog.tsx`**
- Aggiungere `fetchAccountUsers()` separato con filtro `['admin', 'account']`
- Stato `accountUsers` dedicato
- Usare `accountUsers` nel Popover/Command del campo `account_user_id` (riga 1060)

**5. `src/pages/ProjectCanvas.tsx`**
- Aggiungere query `accountUsers` filtrata per `['admin', 'account']`
- Usare `accountUsers` nel campo `EditableField` "Account" (riga 1102)

### Query tipo per accountUsers
```typescript
const { data: accountUsersData } = await supabase
  .from('profiles')
  .select('id, first_name, last_name, email, user_roles!inner(role)')
  .eq('approved', true)
  .is('deleted_at', null)
  .in('user_roles.role', ['admin', 'account'])
  .order('first_name');
```

### File modificati
1. `src/pages/Index.tsx`
2. `src/pages/ProjectBudget.tsx`
3. `src/components/ProjectCard.tsx`
4. `src/components/CreateProjectDialog.tsx`
5. `src/pages/ProjectCanvas.tsx`

