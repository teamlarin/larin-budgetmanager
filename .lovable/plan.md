

## Fix: dialog "Nuova attività" non mostra progetti

### Diagnosi
La query unificata introdotta nell'ultima modifica (riga 159-164 di `CreateManualActivityDialog.tsx`) usa una sintassi PostgREST non valida:

```ts
.select('id, name, project_members!left(user_id)')
.or(`project_leader_id.eq.${currentUser.id},project_members.user_id.eq.${currentUser.id}`)
```

PostgREST non riconosce `project_members.user_id` dentro `.or()` come riferimento alla tabella joinata: viene interpretato come colonna inesistente sulla tabella `projects` → la query fallisce silenziosamente (o non matcha nulla) → lista vuota.

Verificato in DB: l'utente loggato (Alessandro Vettoruzzo) è leader di 21 progetti `aperto` e membro di 35, ma il dialog mostra "Nessun progetto trovato".

### Fix in `src/components/CreateManualActivityDialog.tsx` (righe 152-176)

Tornare a due query parallele (pattern già usato altrove nel codebase) e fare l'unione client-side:

```ts
const [leaderRes, memberRes] = await Promise.all([
  supabase.from('projects')
    .select('id, name')
    .eq('project_status', 'aperto')
    .eq('project_leader_id', currentUser.id),
  supabase.from('projects')
    .select('id, name, project_members!inner(user_id)')
    .eq('project_status', 'aperto')
    .eq('project_members.user_id', currentUser.id),
]);
```

Poi merge con `Map` per deduplicare e ordinamento per `name`.

Mantengo la `queryKey` dinamica con `currentUser?.id` già presente.

### Effetto
Il dialog torna a mostrare i progetti `aperto` di cui l'utente è leader o membro.

### File modificati
- `src/components/CreateManualActivityDialog.tsx` — sostituire la query unificata con due query parallele + merge.

