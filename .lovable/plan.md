

## Pulsante admin "Genera bozza ora" + supporto single-project

Aggiungo un trigger manuale per gli admin in modo da poter testare end-to-end la generazione di un progress draft senza aspettare il cron settimanale del lunedì.

### Modifiche

**1. `supabase/functions/generate-slack-progress-drafts/index.ts`** — accetta body opzionale
- Legge `{ projectId?: string, force?: boolean }` dal POST body
  - `projectId`: filtra il loop a un solo progetto invece di processare tutti gli approvati
  - `force`: bypassa il guard "skip se esiste già una bozza pendente questa settimana" (utile per ri-generare dopo aver scartato)
- Se `projectId` viene passato e il progetto non è eleggibile (non approvato, completato, o senza canale Slack) ritorna 400 con messaggio chiaro
- Lo `stats` di risposta esistente già fornisce `drafts_created`, `skipped_*`, `errors[]` — sufficiente per dare feedback in UI
- L'autenticazione admin esistente resta invariata, così solo gli admin possono triggerare manualmente

**2. `src/components/ProgressUpdateDraftBanner.tsx`** — bottone admin-only
- Aggiungo un hook `useUserRole()` (già esistente nel progetto) per capire se l'utente è admin
- Quando **non c'è una bozza** (`!draft`) e l'utente è admin + il progetto ha un `slackChannelName`, mostro una piccola card discreta:
  ```
  [✨ icon]  Nessuna bozza disponibile · canale #p-latemar-sitoweb
                                      [Genera bozza ora]  ← bottone admin
  ```
- Il click chiama `supabase.functions.invoke('generate-slack-progress-drafts', { body: { projectId, force: true } })`
- Stato loading sul bottone con `Loader2`, toast di feedback in base al risultato:
  - `drafts_created: 1` → "Bozza generata!" + invalidate query (la card si trasforma nel banner della bozza esistente)
  - `skipped_no_messages` → "Pochi messaggi nel canale negli ultimi 7 giorni"
  - `skipped_already_updated` → "C'è già un update pubblicato questa settimana"
  - `errors[]` non vuoto → mostra il primo errore
- Se la bozza esiste già, la card non viene mostrata (resta solo il banner originale)

### Risultato per il test sul progetto Latemar

1. Apri la scheda progetto `/projects/e66e14cb.../canvas`
2. Vedi la card admin "Nessuna bozza · canale #p-latemar-sitoweb · [Genera bozza ora]"
3. Click → l'edge function legge gli ultimi 7 giorni di Slack, l'AI Gemini scrive un draft di 3-4 frasi, viene salvato in `project_update_drafts`
4. Dopo 5-15 secondi la card si trasforma nel banner "💡 Bozza AI pronta"
5. Click "Apri bozza →" → puoi rivedere il testo, modificarlo, scegliere il progress % e pubblicarlo come progress update reale (e opzionalmente ribaltarlo su Slack tramite la notifica già esistente)

### File toccati

- `supabase/functions/generate-slack-progress-drafts/index.ts` — body opzionale + filtro per `projectId` + `force`
- `src/components/ProgressUpdateDraftBanner.tsx` — card admin "Genera bozza ora" quando `!draft`

Nessuna modifica al DB, alle policy RLS o alle altre integrazioni Slack.

