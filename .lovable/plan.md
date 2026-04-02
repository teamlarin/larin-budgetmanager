

## Problema

Le query con `user_roles!inner(role)` nel `CreateProjectDialog` (e negli altri file modificati) non funzionano per utenti non-admin perché le RLS policy su `user_roles` consentono solo:
- Admin: visualizza tutti i ruoli
- Utente: visualizza solo il proprio ruolo

Di conseguenza, un utente non-admin non vede nessun risultato nel dropdown Account e vede tutti gli utenti (senza filtro) in "Assegna a" solo se quella query non usa il join con `user_roles`.

### Soluzione

Creare una funzione `SECURITY DEFINER` che restituisce i profili filtrati per ruolo, bypassando le RLS su `user_roles`. Poi usarla lato client tramite `.rpc()`.

### Modifiche

**1. Migrazione SQL** — nuova funzione DB

```sql
CREATE OR REPLACE FUNCTION public.get_profiles_by_roles(role_filter app_role[])
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  email text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.id, p.first_name, p.last_name, p.email
  FROM profiles p
  JOIN user_roles ur ON ur.user_id = p.id
  WHERE p.approved = true
    AND p.deleted_at IS NULL
    AND ur.role = ANY(role_filter)
  ORDER BY p.first_name;
$$;
```

**2. File da aggiornare** — sostituire le query con `.rpc('get_profiles_by_roles', { role_filter: [...] })`

- `src/components/CreateProjectDialog.tsx` — `fetchAccountUsers()` e `fetchUsers()`
- `src/pages/Index.tsx` — query per `accountUsers` e `users` filtrati
- `src/pages/ProjectBudget.tsx` — query per `accountUsers` e `users` filtrati
- `src/components/ProjectCard.tsx` — fetch interno per `accountUsers`
- `src/pages/ProjectCanvas.tsx` — query per `accountUsers`

Esempio di chiamata:
```typescript
// Account users
const { data } = await supabase.rpc('get_profiles_by_roles', {
  role_filter: ['admin', 'account']
});

// Assegna a
const { data } = await supabase.rpc('get_profiles_by_roles', {
  role_filter: ['admin', 'team_leader', 'account', 'coordinator']
});
```

### Risultato
- Tutti gli utenti (non solo admin) vedranno la lista corretta nei dropdown Account e Assegna a
- La sicurezza è mantenuta: la funzione espone solo `id`, `first_name`, `last_name`, `email`

