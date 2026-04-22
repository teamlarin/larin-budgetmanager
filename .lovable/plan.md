

## Feature #2 — Decision Log nel Canvas di Progetto

Registro timestampato delle decisioni operative dentro il canvas di ogni progetto, posizionato dopo la sezione "Update", con permessi differenziati per ruolo.

### 1. Database (nuova migration Supabase)

**Tabella `project_decisions`**
- `id` UUID PK
- `project_id` UUID FK → `projects(id)` ON DELETE CASCADE
- `content` TEXT NOT NULL
- `created_by` UUID FK → `profiles(id)` NOT NULL
- `created_at` TIMESTAMPTZ DEFAULT now()
- `updated_at` TIMESTAMPTZ
- `updated_by` UUID FK → `profiles(id)`
- Indice su `project_id`
- Trigger su UPDATE per popolare `updated_at` automaticamente

**RLS**
- `SELECT`: `is_approved_user(auth.uid())` (coerente con la policy attuale di `projects`); per gli utenti `external` si filtra via `external_user_projects` come già fatto altrove.
- `INSERT`: utente con ruolo `admin`, `team_leader`, `coordinator`, `account` (via `has_role`).
- `UPDATE` / `DELETE`: `created_by = auth.uid()` OR `has_role(auth.uid(), 'admin')`.

### 2. Nuovo componente `src/components/ProjectDecisions.tsx`

Card riusabile, stessa estetica di `ProjectProgressUpdates`:

- **Header**: titolo `Decisioni (N)` con contatore in tempo reale + bottone `+ Aggiungi decisione` (visibile solo se l'utente ha permesso INSERT).
- **Form inline** (non modale): apparsa al click del bottone, con `Textarea` + bottoni `Annulla` / `Salva decisione`. Ctrl/Cmd+Enter per salvare.
- **Lista**: timeline verticale con pallino + data/ora (`dd/MM/yyyy HH:mm`, locale `it`) + nome autore + contenuto. Ordinata `created_at desc`.
- **Azioni per riga**: `Modifica` (riapre la riga in edit inline) e `Elimina` (con `AlertDialog` di conferma) — visibili solo se `created_by === currentUser.id` o l'utente è admin.
- **Indicatore "modificata"**: piccolo `(modificata il …)` accanto al timestamp se `updated_at` esiste.
- **Stato vuoto**: messaggio "Nessuna decisione registrata. Inizia tracciando la prima."
- Gestione tramite `useQuery` + `useMutation` (TanStack Query) con `invalidateQueries` per refresh automatico, toast di conferma/errore via `sonner` (già usato nel canvas).
- Recupero nome autore con join lookup su `profiles` come fa `ProjectProgressUpdates` (la tabella `profiles` non ha FK auto-inferita).

### 3. Integrazione nel Canvas (`src/pages/ProjectCanvas.tsx`)

- Aggiungere `TabsTrigger value="decisions">Decisioni</TabsTrigger>` accanto a "Update" (nascosto per `external`, come gli altri).
- Aggiungere `<TabsContent value="decisions">` con `<ProjectDecisions projectId={projectId!} />`.
- In alternativa più aderente al doc ("nuova sezione dopo Progress Updates"): renderizzare `<ProjectDecisions />` **dentro** `TabsContent value="updates"` sotto `<ProjectProgressUpdates />`. Procedo con il **tab dedicato** perché si allinea allo stile attuale del canvas e mantiene la pagina leggibile.

### 4. Tipi Supabase

Rigenerazione automatica di `src/integrations/supabase/types.ts` con la nuova tabella `project_decisions` (gestita dal sistema delle migrazioni).

### 5. Permessi (lato UI)

Hook locale che legge `user_roles` dell'utente corrente (pattern già presente in `HelpFeedback.tsx`):
- `canAdd` = ruolo in `['admin', 'team_leader', 'coordinator', 'account']`
- `canModify(decision)` = `decision.created_by === user.id || isAdmin`
- I bottoni vengono nascosti se il permesso manca; le RLS fanno comunque da seconda barriera.

### File creati / modificati

**Nuovi**
- `supabase/migrations/<timestamp>_create_project_decisions.sql` — tabella, indice, trigger updated_at, RLS
- `src/components/ProjectDecisions.tsx` — UI completa della sezione

**Modificati**
- `src/pages/ProjectCanvas.tsx` — nuovo tab "Decisioni" + render del componente
- `src/integrations/supabase/types.ts` — auto-aggiornato con la nuova tabella

### Acceptance criteria coperti

- Sezione "Decisioni" sempre disponibile nel canvas (tab dedicato) ✅
- Aggiunta in <10s grazie al form inline + scorciatoia tastiera ✅
- Timestamp + autore automatici da `auth.uid()` e `now()` ✅
- Ordine `desc` per data ✅
- Modifica/eliminazione limitata a autore o admin (UI + RLS) ✅
- Contatore `(N)` nel titolo ✅

