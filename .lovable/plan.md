

## Diagnosi

Oggi il dialog di update (`ProgressUpdateDialog`) usato da Dashboard, scheda progetto (Canvas) e cella % della lista non sa nulla della bozza AI. La bozza è visibile solo dentro la tab **Update** del Canvas tramite `ProgressUpdateDraftBanner`. Inoltre, cliccando la notifica `progress_draft_ready` si arriva a `/projects/:id/canvas?openDraft=1` ma la tab di default è "Report & Analytics", quindi il banner draft non è montato e nulla si apre.

## Cosa cambia per l'utente

1. **Dialog "Aggiorna progresso" mostra la bozza AI**
   - Quando esiste una bozza `pending` per il progetto, all'apertura del dialog (da Dashboard, Canvas, lista Progetti, tab Update) viene mostrato un banner "Bozza AI disponibile" con data e fonti (Slack/Meet/email).
   - Bottone **"Usa bozza AI"** → precompila il campo Update con il testo della bozza.
   - Pubblicando l'update, la bozza viene marcata come `published` (collegata al nuovo `progress_update_id`), così non riappare la volta dopo.
   - Se l'utente preferisce scrivere a mano, ignora il banner.

2. **Notifica → tab corretta**
   - In `ProjectCanvas`, se l'URL contiene `?openDraft=1` o `?draft=<id>`, la tab attiva diventa automaticamente **Update**, dove il banner draft è già pronto ad auto-aprire `ProgressUpdateDraftDialog`. L'esperienza dalla notifica resta quella ricca con tutti i dettagli (sorgenti, scarta, ecc.).

3. **Coerenza percorsi rapidi**
   - Dashboard / cella % / pulsante "Nuovo aggiornamento" → dialog leggero con shortcut alla bozza.
   - Notifica → tab Update con dialog completo (`ProgressUpdateDraftDialog`).
   Entrambi i flussi mostrano la bozza, senza dover cambiare tab manualmente.

## Cosa cambia tecnicamente

### `src/components/ProgressUpdateDialog.tsx`
- Aggiungo una `useQuery` su `project_update_drafts` (`status='pending'`, ultimo per `project_id`) abilitata solo quando `open=true`.
- Se la bozza esiste, sotto l'header del dialog mostro una `Card` compatta:
  - Icona `Sparkles`, "Bozza AI del {data}", chip con conteggi `slack/meet/email`.
  - Bottoni: **Usa bozza** (popola `updateText` e marca uno stato `draftApplied`) e **Ignora**.
- In `handleSave`, se `draftApplied` e `draftId` valorizzati, dopo `publishProgressUpdate` aggiorno `project_update_drafts` con `status='published'`, `published_progress_update_id`, `reviewed_at`, `reviewed_by` (stessa logica di `ProgressUpdateDraftDialog`).
- Invalido `['progress-update-draft', projectId]` per allineare il banner della tab Update.

### `src/pages/ProjectCanvas.tsx`
- Da `defaultValue` a stato controllato: `const [activeTab, setActiveTab] = useState(...)`.
- `useEffect` su `useSearchParams`: se presente `openDraft=1` o `draft=...` e `!isExternal`, set `activeTab = 'updates'` (una sola volta per mount).
- `<Tabs value={activeTab} onValueChange={setActiveTab}>`.
- Il banner dentro la tab Update continua a fare auto-open del dialog completo (logica esistente in `ProgressUpdateDraftBanner`).

### Nessuna modifica DB
- RLS e tabelle esistenti già supportano lettura/aggiornamento di `project_update_drafts` per gli autorizzati (admin / team_leader / project_leader).
- Per gli altri utenti, la query del banner restituirà semplicemente `null` (RLS) e il dialog non mostrerà la bozza, senza errori.

## File toccati

- `src/components/ProgressUpdateDialog.tsx` — query bozza + banner inline + marcatura published in save.
- `src/pages/ProjectCanvas.tsx` — tab controllata + auto-switch su `?openDraft`/`?draft`.

## Note

- Nessuna duplicazione: il dialog leggero non sostituisce `ProgressUpdateDraftDialog` (che resta per il flusso "review completa" da banner/notifica), ma offre un accesso rapido alla bozza in tutti gli altri entry point.
- La cella % della lista in `ApprovedProjects` e la card nella `MemberDashboard` ereditano automaticamente il nuovo comportamento (usano lo stesso `ProgressUpdateDialog`).
- Nessun cambio API/edge function.

