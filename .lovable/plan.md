

## Obiettivo

1. Solo **admin**, **team_leader** e **project_leader** del progetto possono pubblicare un progress update.
2. Un **member** vede in lista solo i progetti dove è Project Leader o membro del team (la RLS lo prevede già, ma alcuni componenti/query hanno fallback "vedo tutto" — verifichiamo e blindiamo).

## Cosa cambia per l'utente

### Aggiornamento progresso (gating UI + DB)

- Pulsante **"Nuovo aggiornamento"** in `ProjectProgressUpdates` mostrato solo se: `admin` OR `team_leader` OR `auth.uid() = project_leader_id`.
- Card **Progress** cliccabile in `ProjectCanvas` (3 punti onClick → `setShowProgressDialog`): cursore + onClick attivi solo se autorizzato; altrimenti card non interattiva.
- Cella **Progress** cliccabile in `ApprovedProjects` (lista): apre il dialog solo se l'utente è admin/team_leader o leader di quel singolo progetto; altrimenti niente click.
- Banner **"Bozza AI pronta"** (`ProgressUpdateDraftBanner`) e pulsante **"Genera bozza ora"**: visibili solo agli autorizzati (oggi sono solo admin per "Genera ora", ma l'apertura della bozza la vede chiunque — la limitiamo agli stessi tre ruoli/leader).
- Se un utente non autorizzato tenta comunque la pubblicazione (es. deep-link `?openDraft=1`), `publishProgressUpdate` solleva un errore chiaro lato client e la RLS lo blocca lato DB.

### Visibilità progetti per ruolo `member`

- La RLS attuale su `projects` è già corretta: i member vedono solo progetti dove sono `project_leader_id` o presenti in `project_members`.
- Verifichiamo che le pagine **Index (Budgets)**, **ApprovedProjects**, **Dashboard**, **Workload** non bypassino la RLS con query "tutto" per ruolo member. In particolare:
  - `getRolePermissions('member').canViewAllProjects` resta `false` (già così).
  - Nessuna query usa il service role lato client (verificato).
- La RLS già filtra automaticamente: nessuna modifica DB necessaria per la lista. Aggiungiamo solo un test rapido confermando dietro le quinte che il member non vede niente di estraneo.

## Cosa cambia tecnicamente

### Database (1 migration)

1. **RLS `project_progress_updates` — INSERT** (oggi: chiunque autenticato con `user_id = auth.uid()`):
   ```sql
   DROP POLICY "Authenticated users can insert progress updates" ON public.project_progress_updates;

   CREATE POLICY "Only leaders, admins, team leaders insert progress updates"
   ON public.project_progress_updates
   FOR INSERT TO authenticated
   WITH CHECK (
     auth.uid() = user_id
     AND (
       public.has_role(auth.uid(), 'admin')
       OR public.has_role(auth.uid(), 'team_leader')
       OR EXISTS (
         SELECT 1 FROM public.projects p
         WHERE p.id = project_id AND p.project_leader_id = auth.uid()
       )
     )
   );
   ```

2. **Helper SECURITY DEFINER** per usarlo lato UI/RPC:
   ```sql
   CREATE OR REPLACE FUNCTION public.can_update_project_progress(_project_id uuid)
   RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
     SELECT
       public.has_role(auth.uid(), 'admin')
       OR public.has_role(auth.uid(), 'team_leader')
       OR EXISTS (
         SELECT 1 FROM public.projects p
         WHERE p.id = _project_id AND p.project_leader_id = auth.uid()
       );
   $$;
   ```

3. (Opzionale, sicurezza) RLS `project_update_drafts` UPDATE/DELETE → solo stessi tre ruoli/leader, così un member non può marcare draft come `discarded`.

### Frontend

- **`src/lib/permissions.ts`**: aggiungo permesso `canPublishProgressUpdate` nel tipo `Permission`, con default `true` per admin/team_leader, `false` per gli altri (i project leader saranno autorizzati a runtime con check sul singolo progetto).
- **Nuovo hook `useCanUpdateProjectProgress(projectId, projectLeaderId?)`**: ritorna `true` se admin/team_leader oppure `auth.uid() === projectLeaderId`. Evita roundtrip DB.
- **`ProjectProgressUpdates.tsx`**: nasconde "Nuovo aggiornamento" e il banner draft se non autorizzato.
- **`ProjectCanvas.tsx`**: rimuove `cursor-pointer`/`onClick` su Progress card e progress label se non autorizzato.
- **`ApprovedProjects.tsx`**: rimuove `onClick` sulla cella Progress per progetti dove l'utente non è autorizzato.
- **`ProgressUpdateDraftBanner.tsx`**: la condizione `if (!isAdmin)` per "Genera ora" resta; aggiungo gating analogo per mostrare il banner "Bozza pronta" + "Apri bozza" solo agli autorizzati.
- **`src/lib/progressUpdates.ts`**: messaggio d'errore esplicito se la INSERT viene rifiutata dalla RLS (`Solo Project Leader, Admin e Team Leader possono pubblicare aggiornamenti`).

### File toccati

- nuova migration `…_restrict_progress_updates.sql`
- `src/lib/permissions.ts`
- `src/hooks/useCanUpdateProjectProgress.ts` (nuovo)
- `src/components/ProjectProgressUpdates.tsx`
- `src/components/ProgressUpdateDraftBanner.tsx`
- `src/pages/ProjectCanvas.tsx`
- `src/pages/ApprovedProjects.tsx`

## Note

- I **member** non avranno più alcun ingresso UI all'update progresso, anche se per qualche progetto risultassero membri del team.
- I **project leader** (qualsiasi ruolo globale) restano autorizzati grazie al check su `project_leader_id`.
- Il ruolo `account` perde la possibilità di pubblicare update (oggi i suoi click funzionano via `is_approved_user`). Confermo: deve restare bloccato (non è nei tre ruoli richiesti).
- Visibilità progetti per `member`: nessuna modifica DB necessaria, RLS già corretta. Verifichiamo solo che nessuna pagina aggiri il filtro.

