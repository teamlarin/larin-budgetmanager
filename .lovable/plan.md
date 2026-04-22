

## Feature #15 — Draft automatico Progress Update da Slack AI

Bozza settimanale del progress update generata via AI dai messaggi Slack del canale collegato al progetto, che il Project Leader rivede e pubblica con un click.

### 1. Database (nuova migration)

**Estensione `projects`**
- `slack_channel_id TEXT NULL`
- `slack_channel_name TEXT NULL`

**Nuova tabella `project_update_drafts`**
- `id UUID PK default gen_random_uuid()`
- `project_id UUID FK → projects(id) ON DELETE CASCADE`
- `draft_content TEXT NOT NULL`
- `generated_from TEXT DEFAULT 'slack_ai'`
- `slack_messages_count INTEGER`
- `week_start DATE NOT NULL`
- `status TEXT DEFAULT 'pending'` CHECK in (`pending`, `published`, `discarded`)
- `published_progress_update_id UUID NULL FK → project_progress_updates(id)`
- `created_at TIMESTAMPTZ DEFAULT now()`
- `reviewed_at TIMESTAMPTZ NULL`
- `reviewed_by UUID NULL FK → profiles(id)`
- Indice unico parziale: `(project_id, week_start) WHERE status = 'pending'` per evitare duplicati settimanali
- Indice su `(project_id, status)`

**RLS**
- `SELECT/UPDATE`: project leader del progetto, oppure admin/account assegnato (`has_role` admin OR `projects.project_leader_id = auth.uid()` OR `account_user_id = auth.uid()`)
- `INSERT`: solo `service_role` (cron job lato edge function)
- `DELETE`: admin

**Cron pg_cron**
- Job `slack-progress-draft-thursday` ogni giovedì 08:00 Europe/Rome → invoca edge function `generate-slack-progress-drafts` con header `CRON_SECRET` (pattern già usato).

### 2. Edge Functions

**`supabase/functions/generate-slack-progress-drafts/index.ts`** (cron)
1. Auth via `CRON_SECRET`.
2. Calcola `week_start` (lunedì corrente) e finestra ultimi 7 giorni.
3. Query: progetti con `slack_channel_id IS NOT NULL`, status `approvato`/in corso, **senza** `project_progress_updates` in questa settimana e **senza** draft `pending` per questa `week_start`.
4. Per ogni progetto:
   - `conversations.history` via Slack Gateway (connector Slack già esistente — `SLACK_API_KEY`) per `channel = slack_channel_id`, `oldest = now-7d`.
   - Filtra: niente `subtype=bot_message`, `bot_id`, messaggi `<5` parole, niente system messages.
   - Se messaggi utili `>= 3` → chiamata LLM via Lovable AI Gateway (`LOVABLE_API_KEY`, modello `google/gemini-2.5-flash`) con prompt da spec (anti-hallucination, niente nomi).
   - Insert in `project_update_drafts` (status `pending`).
   - Insert notifica in-app (`type: 'progress_draft_ready'`) per il `project_leader_id` con `project_id`.
   - Email opzionale via Mandrill (rispetta `notification_preferences.email_enabled` per `progress_draft_ready`, default true).
5. Logging dettagliato per debug (numero progetti processati, draft creati, errori per progetto).
6. **Privacy**: i messaggi Slack non vengono mai persistiti — solo aggregati per il prompt e poi scartati.

**`supabase/functions/list-slack-channels/index.ts`**
- Endpoint autenticato (admin/team_leader/account/coordinator) per popolare il selector "Canale Slack" nel canvas.
- Pagina `conversations.list` (`types=public_channel,private_channel`, `exclude_archived=true`) via gateway, ritorna `[{id, name, is_private}]`.

### 3. UI

**`src/components/ProjectSlackChannelPicker.tsx`** (nuovo)
- Combobox + ricerca, popolato da `list-slack-channels`.
- Mostrato nel canvas (sezione "Integrazioni progetto") con campo "Canale Slack" + bottone "Rimuovi collegamento".
- Visibile/editabile solo a admin, account assegnato, project leader.
- Salva su `projects.slack_channel_id` + `slack_channel_name`.

**`src/components/ProgressUpdateDraftBanner.tsx`** (nuovo)
- Banner in cima a `ProjectProgressUpdates` se esiste un draft `pending` per la settimana corrente del progetto corrente.
- Copy: "💡 Bozza AI pronta · generata da {N} messaggi Slack · {data}".
- CTA: `[ Apri bozza → ]` apre `ProgressUpdateDraftDialog`.

**`src/components/ProgressUpdateDraftDialog.tsx`** (nuovo)
- Layout secondo mockup:
  - Header: titolo, data, sorgente (`#canale`).
  - Stato (select), Progresso (numeric), Update (textarea precompilata con `draft_content`), Roadblocks (textarea vuota).
  - Footer: `[ Scarta bozza ]` (status → `discarded`) · `[ Pubblica update ]`.
- "Pubblica" = stesso path di salvataggio di `ProgressUpdateDialog` (insert in `project_progress_updates` + update progress + Slack notification esistente), poi marca draft `published` con `published_progress_update_id`, `reviewed_at`, `reviewed_by`.
- Refactor minimo: estraggo `saveProgressUpdate(projectId, payload)` da `ProgressUpdateDialog.tsx` in `src/lib/progressUpdates.ts` e lo riutilizzo nel dialog draft.

**`src/components/NotificationBell.tsx`** (modifica)
- Aggiungo handling per `type: 'progress_draft_ready'` con icona 💡 e click → naviga al canvas progetto + apre il dialog draft (query param `?draft=<id>`).

**`src/pages/Notifications.tsx`** — etichetta nuovo tipo notifica.

**`src/pages/Settings.tsx` / `IntegrationsTab.tsx`**
- Nello stato attuale Slack è già configurato come connector (workspace level). Aggiungo solo una sezione informativa "Slack — Draft Progress Update" con stato connessione (verifica via `verify_credentials` del gateway) e link alla pagina connettori per estendere gli scope `channels:history`, `groups:history`, `users:read`. Se mancano scope, mostro CTA "Aggiungi permessi" che apre il connector.

### 4. Permessi & preferenze notifiche

- Aggiungo riga di default in `notification_preferences` per il nuovo tipo `progress_draft_ready` (in-app on, email on) — gestita lato UI come gli altri tipi.
- RLS draft già limita la visibilità.

### 5. File creati / modificati

**Nuovi**
- `supabase/migrations/<ts>_project_update_drafts.sql`
- `supabase/functions/generate-slack-progress-drafts/index.ts`
- `supabase/functions/list-slack-channels/index.ts`
- `src/components/ProjectSlackChannelPicker.tsx`
- `src/components/ProgressUpdateDraftBanner.tsx`
- `src/components/ProgressUpdateDraftDialog.tsx`
- `src/lib/progressUpdates.ts` (helper condiviso di publish)

**Modificati**
- `src/pages/ProjectCanvas.tsx` — picker canale Slack + integrazione banner draft nel tab "Update"
- `src/components/ProjectProgressUpdates.tsx` — montaggio del banner
- `src/components/ProgressUpdateDialog.tsx` — usa helper condiviso
- `src/components/NotificationBell.tsx` + `src/pages/Notifications.tsx` — nuovo tipo notifica
- `src/integrations/supabase/types.ts` — auto-aggiornato

### 6. Flusso tecnico riassunto

```text
Cron Gio 08:00 → generate-slack-progress-drafts
  ├─ select progetti idonei (slack_channel_id, no update questa settimana, no draft pending)
  ├─ Slack conversations.history (gateway) → filtro qualità
  ├─ se >=3 messaggi → LLM (anti-hallucination) → draft_content
  ├─ insert project_update_drafts (pending)
  └─ insert notifications (progress_draft_ready) + email Mandrill

PL clicca notifica → /projects/:id/canvas?draft=<id>
  └─ ProgressUpdateDraftDialog
       ├─ Pubblica → saveProgressUpdate() + draft.status='published'
       └─ Scarta → draft.status='discarded'
```

### Acceptance criteria coperti

- Notifica giovedì mattina con link alla bozza ✅
- Bozza basata su messaggi reali ultimi 7 giorni ✅
- PL può modificare ogni campo prima di pubblicare ✅
- Possibilità di scartare ✅
- Nessuna bozza se messaggi rilevanti < 3 ✅
- Connessione Slack workspace-level (connector esistente) ✅
- Canale associabile dal canvas ✅
- Nessun messaggio Slack persistito ✅
- Prompt LLM con istruzioni anti-hallucination ✅

