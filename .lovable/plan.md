

## Filtra progetti nel dialog "Nuova attività manuale"

### Diagnosi
Il dialog `CreateManualActivityDialog` (riga 152-195) filtra già per `project_status='aperto'` e per appartenenza (membro o leader). Tuttavia:
- **queryKey statica** (`'user-member-projects-for-manual-activity'`) → cache condivisa tra utenti diversi e nessun refresh quando cambia lo stato di un progetto.
- Risultato: l'utente vede una lista vecchia con progetti che nel frattempo sono passati a `completato`.

### Fix in `src/components/CreateManualActivityDialog.tsx` (righe 152-195)

1. **queryKey dinamica**: aggiungere `currentUser?.id` per evitare cache cross-user.
2. **Singola query unificata** che fa l'OR direttamente in DB invece di due round-trip:
   ```ts
   .from('projects')
   .select('id, name, project_members!inner(user_id)')
   .eq('project_status', 'aperto')
   .or(`project_leader_id.eq.${user.id},project_members.user_id.eq.${user.id}`)
   ```
   Più semplice, sempre coerente, niente rischio di union sbagliata.
3. **Invalidazione cache** dopo cambio stato progetto: aggiungere `queryClient.invalidateQueries({ queryKey: ['user-member-projects-for-manual-activity'] })` nei punti dove un progetto cambia `project_status`.

### Effetto
- Nel dialog di creazione attività compaiono **solo** progetti `aperto` di cui l'utente è team member o project leader.
- Quando un progetto passa a `completato`/`in_partenza`/`da_fatturare`, sparisce immediatamente dalla lista.

### File modificati
- `src/components/CreateManualActivityDialog.tsx` — riscrivere la query `projects` (righe 152-195) e aggiungere `currentUser?.id` alla queryKey.

Nessuna modifica al DB.

