

## Generazione bozze multi-fonte: Slack + Google Drive (Meet) + Gmail

Estendo l'attuale flusso `generate-slack-progress-drafts` per aggregare contesto da **3 fonti** invece di 1, mantenendo lo stesso punto di ingresso (cron settimanale + pulsante "Genera bozza ora") e lo stesso UI nel banner/dialog.

### Cosa cambia per l'utente

- Stesso pulsante "Genera bozza ora" e stesso cron del lunedì.
- La bozza generata ora tiene conto di:
  1. **Messaggi Slack** del canale collegato (come oggi).
  2. **Trascrizioni Google Meet** trovate come Google Docs nella cartella Drive del progetto e, in fallback, nella cartella Drive del cliente.
  3. **Email Gmail** scambiate con i contatti del cliente del progetto **OR** con oggetto contenente nome progetto/cliente.
- Nel dialog mostro un breakdown delle fonti usate (es. "12 messaggi Slack · 2 trascrizioni Meet · 7 email").
- Se una fonte non è disponibile (Drive non collegato al progetto, niente email pertinenti, niente trascrizioni), la salto in silenzio e segnalo nel banner quali fonti hanno contribuito.

### Connettori da collegare al progetto

Tre connessioni esistono già nel workspace ma non sono linkate al progetto Lovable. Vanno collegate:
- `Drive Larin` (google_drive)
- `Google Mail` (google_mail)
- `TimeTrap` (slack) — già collegato

### Architettura

```text
                ┌─────────────────────────────────────┐
                │ generate-progress-drafts (rinominata │
                │ da generate-slack-progress-drafts)   │
                └─────────────────────────────────────┘
                          │
          ┌───────────────┼────────────────┐
          ▼               ▼                ▼
    ┌──────────┐   ┌────────────┐   ┌─────────────┐
    │  Slack   │   │   Drive    │   │   Gmail     │
    │ history  │   │ (Meet docs)│   │ (filtered)  │
    └──────────┘   └────────────┘   └─────────────┘
          │               │                │
          └───────────────┼────────────────┘
                          ▼
                 ┌──────────────────┐
                 │  Lovable AI      │
                 │  Gemini 2.5 Flash│
                 └──────────────────┘
                          ▼
                 project_update_drafts
```

### Modifiche tecniche

**1. Database (`project_update_drafts`)**

Aggiungo colonne contatori per la trasparenza nel banner/dialog (migrazione):

```sql
ALTER TABLE public.project_update_drafts
  ADD COLUMN IF NOT EXISTS drive_docs_count int,
  ADD COLUMN IF NOT EXISTS gmail_messages_count int,
  ADD COLUMN IF NOT EXISTS sources_used jsonb DEFAULT '[]'::jsonb;
```

`generated_from` passa da `"slack_ai"` a `"multi_source_ai"`. Le righe esistenti restano leggibili (campo testo libero).

**2. Edge function `generate-slack-progress-drafts/index.ts`**

- Mantengo path/nome per compatibilità con cron pg_cron e con l'invoke dal frontend.
- Aggiungo helper:
  - `fetchDriveTranscripts(projectFolderId, clientFolderId)` → cerca via Drive API v3 (`https://connector-gateway.lovable.dev/google_drive/drive/v3/files`) i Google Docs ricorsivamente nelle cartelle indicate, filtrando per:
    - `mimeType='application/vnd.google-apps.document'`
    - `modifiedTime > now - lookbackDays`
    - nome contiene `Transcript` / `Trascrizione` / `Meet` / `Recording`
    Per ogni doc, chiamo Docs API (`/google_docs/v1/documents/{id}`) ed estraggo solo il testo dai `textRun`. Limito a max 5 doc, 8k caratteri ciascuno.
  - `fetchGmailMessages(clientContactEmails, projectName, clientName)` → query `q=` Gmail combinata:
    `(from:a@x.com OR to:a@x.com OR ...) OR subject:"NomeProgetto" OR subject:"NomeCliente"`, filtro `newer_than:14d`, max 30 messaggi, estraggo solo `snippet` + `subject` + `from`.
- Nel runner principale, dopo `fetchSlackMessages` chiamo le altre due fonti **in parallelo** con `Promise.allSettled` per non far fallire la bozza se Drive o Gmail rispondono con errori (loggo e salto).
- `generateDraft` riceve un oggetto `{ slack: string[], drive: {title, text}[], gmail: {subject, from, snippet}[] }` e lo serializza nel prompt con sezioni dedicate (`### Slack messages`, `### Meet transcripts`, `### Email recenti`).
- Aggiorno il system prompt per chiedere di:
  - dare priorità a decisioni emerse dai Meet,
  - integrare con segnali da email e Slack,
  - segnalare esplicitamente in coda alla bozza quali fonti hanno avuto poca attività.
- Soglia di "useFallback": cambia da `relevant.length < minMessages` a `(slack + drive + gmail) totale < minSignals` (default 1 in manuale, 3 in cron).
- Salvataggio bozza include i nuovi contatori e `sources_used`.

**3. Risoluzione cartelle Drive**

Il progetto già ha `drive_folder_id` e il cliente collegato ha `clients.drive_folder_id`. La query attuale di `projects` nell'edge function va estesa per fare il join con `clients` e leggere entrambe.

**4. Risoluzione email contatti cliente**

Recupero gli email dei contatti tramite la tabella `client_contact_companies` → `client_contacts`. Limito ai contatti collegati al `client_id` del progetto. Se 0 contatti con email, uso solo il filtro per `subject`.

**5. Frontend**

- `ProgressUpdateDraftDialog.tsx`: badge "Generata da" diventa breakdown:
  `"12 Slack · 2 Meet · 7 email"` (mostra solo le fonti con count > 0).
- `ProgressUpdateDraftBanner.tsx`: stessa cosa nel sottotitolo.
- `ProgressUpdateDraft` interface: aggiungo `drive_docs_count`, `gmail_messages_count`, `sources_used`.
- I toast del pulsante "Genera bozza ora" diventano più informativi: messaggio "Nessun segnale rilevante" invece di "Nessun messaggio Slack" quando tutte le fonti sono vuote.

**6. Connettori e secrets**

Servono variabili d'ambiente nelle edge function:
- `SLACK_API_KEY` (già presente)
- `GOOGLE_DRIVE_API_KEY` (da collegare)
- `GOOGLE_MAIL_API_KEY` (da collegare)
- `LOVABLE_API_KEY` (già presente)

Quando il connettore Drive o Gmail non è linkato, l'edge function salta quella fonte senza errore (controllo presenza variabile).

### File toccati

- `supabase/functions/generate-slack-progress-drafts/index.ts` (riscrittura del flusso fetch + prompt)
- Migrazione SQL: 3 colonne in `project_update_drafts`
- `src/components/ProgressUpdateDraftDialog.tsx` (badge fonti + interface)
- `src/components/ProgressUpdateDraftBanner.tsx` (sottotitolo + interface)
- Aggiornamento `src/integrations/supabase/types.ts` (auto-generato dopo migrazione)

### Limiti noti / scelte intenzionali

- **Trascrizioni Meet**: il sistema funziona se le trascrizioni vengono salvate nella cartella Drive del progetto/cliente (comportamento standard se l'utente collega Meet a una cartella o sposta il file). Le trascrizioni che restano in `/Meet Recordings/` personali del singolo utente non sono accessibili: avvisiamo nella documentazione.
- **Privacy email**: il prompt di sistema esistente già vieta di citare nomi di persona; lo rafforzo per i mittenti email.
- **Costi**: il payload AI cresce ma resto sotto i ~15k token per call usando troncamenti (Slack 30 msg × 500 char, Meet 5 doc × 8k char, Gmail 30 msg × 200 char snippet).
- **Compatibilità**: bozze già esistenti continuano a funzionare nel dialog (i nuovi count sono nullable).

### Ordine di esecuzione (dopo approvazione)

1. Collegare al progetto i connettori `google_drive` e `google_mail` (l'agente attiva i prompt).
2. Migrazione SQL.
3. Riscrittura edge function.
4. Aggiornamento UI banner + dialog.
5. Test manuale via "Genera bozza ora" su un progetto con cartella Drive collegata + canale Slack.

