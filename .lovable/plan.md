

## Fix: il ruolo Coordinator non è incluso nel tipo userRole di Settings.tsx

### Problema
Il tipo del state `userRole` nella pagina Settings (riga 32) elenca solo `'admin' | 'account' | 'finance' | 'team_leader' | 'member' | 'external'` — manca `'coordinator'`. Quando un coordinator accede alle impostazioni, il ruolo viene castato a `null` e le tab non vengono mostrate.

### Intervento

**File: `src/pages/Settings.tsx`**
Aggiungere `'coordinator'` al tipo union dello state `userRole` alla riga 32.

```ts
// Da:
const [userRole, setUserRole] = useState<'admin' | 'account' | 'finance' | 'team_leader' | 'member' | 'external' | null>(null);

// A:
const [userRole, setUserRole] = useState<'admin' | 'account' | 'finance' | 'team_leader' | 'coordinator' | 'member' | 'external' | null>(null);
```

Stessa aggiunta alla riga 96 dove il ruolo viene castato:
```ts
const role = roleData?.role as '...' | 'coordinator' | '...' | null;
```

Nessun'altra modifica necessaria: i permessi del coordinator (`canManageClients`, `canManageProducts`, `canManageServices`, `canManageTemplates`) sono già `true` nel file `permissions.ts`, e le tab di Settings usano già quei permessi per la visibilità.

