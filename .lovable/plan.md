
Obiettivo: correggere il dialog “Crea nuovo budget - Step 1 di 2” perché il campo “Assegna a” mostri solo utenti con ruolo `admin`, `team_leader`, `account`, `coordinator`.

Causa trovata:
- Il filtro corretto è già presente in `Index.tsx` e `ProjectBudget.tsx` tramite `supabase.rpc('get_profiles_by_roles', ...)`.
- Nel file `src/components/CreateProjectDialog.tsx`, invece, `fetchUsers()` usa ancora una query diretta su `profiles`, quindi carica tutti gli utenti approvati.
- Il select “Assegna a” del dialog usa proprio quello stato `users`, per questo vedi ancora tutti gli utenti.

Modifica da fare:
1. Aggiornare `src/components/CreateProjectDialog.tsx`
   - Sostituire `fetchUsers()` con una chiamata RPC a `get_profiles_by_roles`
   - Usare il filtro:
     - `['admin', 'team_leader', 'account', 'coordinator']`
   - Lasciare invariato `fetchAccountUsers()` perché il campo Account ora funziona già correttamente

Query da usare:
```typescript
const { data, error } = await supabase.rpc('get_profiles_by_roles', {
  role_filter: ['admin', 'team_leader', 'account', 'coordinator']
});
```

Punti da verificare dopo la modifica:
- Nel dialog “Crea nuovo budget”, il campo “Account” continua a mostrare solo `admin` e `account`
- Il campo “Assegna a” mostra solo `admin`, `team_leader`, `account`, `coordinator`
- Nessun utente con ruolo diverso (es. member o altri) compare nel dropdown
- Il comportamento resta corretto anche per utenti non admin, grazie alla funzione `SECURITY DEFINER` già introdotta

Dettagli tecnici:
- File da modificare: `src/components/CreateProjectDialog.tsx`
- Nessuna nuova migrazione SQL necessaria
- Nessun cambio UI strutturale: si interviene solo sulla sorgente dati del select “Assegna a”
