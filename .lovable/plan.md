# Trascrizioni Meet → Cartella Drive del progetto

Quando un utente conferma uno slot del calendario collegato a un evento Google Calendar di cui è organizzatore, copia automaticamente la trascrizione del Meet in una sottocartella `Meeting` della cartella Drive del progetto.

## Comportamento

1. L'utente conferma uno slot (singolo o batch) dal calendario.
2. Per ogni tracking confermato che ha `google_event_id`:
   - Si recupera l'evento via Google Calendar API includendo `attachments` e `organizer`.
   - Se l'utente corrente **non** è l'`organizer` dell'evento → skip silenzioso.
   - Se il progetto associato **non** ha `drive_folder_id` → skip con log (no toast bloccante).
   - Si filtrano gli allegati che sono **documenti di trascrizione Meet** (mimeType `application/vnd.google-apps.document` con `fileUrl` Drive). La registrazione video viene esclusa.
   - Si garantisce l'esistenza di una sottocartella `Meeting` nella cartella Drive del progetto (lookup per nome + parent, altrimenti `files.create` mimeType `folder`).
   - Si copia ogni trascrizione nella sottocartella `Meeting` via Drive API `files.copy` rinominandola con il pattern: `YYYY-MM-DD - <Titolo evento> - Trascrizione`.
3. Toast riepilogativo (non bloccante) con il totale dei file copiati.
4. Idempotenza: la copia non viene ripetuta su riconferme dello stesso slot/file.

## Vincoli

- **Solo organizzatore**: la copia parte unicamente se `event.organizer.self === true` (o email match con il profilo dell'utente).
- **Solo trascrizione**: niente registrazione video, solo il Google Doc di trascrizione.
- **Solo se progetto + cartella Drive**: serve `project.drive_folder_id`.
- **Non bloccante**: errori della copia non fanno fallire la conferma dello slot.

## Dettagli tecnici

### Schema DB (migrazione)
Nuova tabella `meet_attachment_copies` per idempotenza:
- `id uuid pk`
- `tracking_id uuid` → `activity_time_tracking.id`
- `google_event_id text`
- `source_file_id text` (id Drive originale)
- `copied_file_id text` (id Drive nel target)
- `project_id uuid`
- `copied_by uuid`
- `copied_at timestamptz default now()`
- unique(`tracking_id`, `source_file_id`)
- RLS: select per admin/owner, insert/update solo da service role.

### Edge function: `copy-meet-attachments-to-project`
`verify_jwt = true`. Input: `{ tracking_id }`. Flow:
1. Carica tracking + budget_item + project (`drive_folder_id`, `name`) + utente chiamante.
2. Risolve i token Google dell'utente da `user_google_tokens` (refresh se scaduto, stessa logica di `google-calendar-events`).
3. `GET calendar/v3/calendars/primary/events/{eventId}?fields=organizer,attachments,start,summary` (provando le calendarId selezionate finché l'evento è trovato).
4. Verifica `organizer.self === true`. Altrimenti exit 200 `{skipped: 'not_organizer'}`.
5. Filtra `attachments` con mimeType `application/vnd.google-apps.document` (trascrizioni Meet). Per ciascuno:
   - Skip se già in `meet_attachment_copies`.
   - Risolve/crea sottocartella `Meeting` dentro `project.drive_folder_id` (cache in memoria per il batch).
   - `POST drive/v3/files/{fileId}/copy?supportsAllDrives=true` con body `{ name: "<YYYY-MM-DD> - <event.summary> - Trascrizione", parents: [meetingFolderId] }`.
   - Inserisce riga in `meet_attachment_copies`.
6. Ritorna `{ copied: n, skipped: m, errors: [...] }`.

### Frontend (`src/pages/Calendar.tsx`)
- In `confirmTrackingMutation.onSuccess` e `batchConfirmMutation.onSuccess`, per ogni tracking con `google_event_id` invocare `supabase.functions.invoke('copy-meet-attachments-to-project', { body: { tracking_id } })` in fire-and-forget.
- Toast aggiuntivo (non bloccante) col totale di trascrizioni copiate.
- Nessuna modifica al flusso esistente di conferma.

### Scope Google
La trascrizione Meet è di proprietà dell'organizzatore, quindi gli scope Drive già usati dal connettore Calendar (`drive.file` + lettura) sono sufficienti per copia. Se il refresh fallisce per scope mancante, si segnala all'utente di riconnettere Google.
