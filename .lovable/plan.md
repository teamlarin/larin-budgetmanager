

## Piano: Gmail multi-utente per i progress draft via Service Account + Domain-Wide Delegation

### Obiettivo

Far sì che la generazione delle bozze di progress update legga le email di **ciascun Project Leader** (22 utenti `@larin.it`) e non solo l'inbox di Alessandro.

### Come funziona

Si usa un **Google Service Account** con **Domain-Wide Delegation** abilitata sul Workspace `larin.it`. Per ogni progetto, l'edge function genera un JWT firmato che impersona l'email del Project Leader e ottiene un access token Google per leggere **solo** la sua inbox (scope `gmail.readonly`). Nessun consenso utente, nessun OAuth per-utente, nessun token da rinfrescare manualmente.

```text
┌───────────────────────┐
│ generate-slack-       │
│ progress-drafts       │
└──────────┬────────────┘
           │  per ogni progetto:
           │  leader_email = profiles.email
           ▼
   ┌──────────────────┐    impersona     ┌────────────────┐
   │ Service Account  ├─────────────────►│ Gmail di       │
   │ + DWD            │  via JWT signed  │ paolo@larin.it │
   └──────────────────┘                  └────────────────┘
```

L'attuale connettore Lovable Gmail (account di Alessandro) **resta come fallback** quando il PL non ha email `@larin.it` o quando il service account non è configurato.

---

### Cosa serve da te (operazioni Google Cloud / Workspace)

**Tu sei admin del dominio `larin.it`?** Se sì, ti servono ~10 minuti:

1. **Google Cloud Console** → crea/seleziona un progetto (es. "Larin Backend")
2. Abilita **Gmail API** nella libreria
3. **IAM & Admin → Service Accounts** → crea service account `larin-gmail-reader`
4. Sul service account → **Keys** → "Add Key" → JSON → scarica il file (lo incollerai in un secret Supabase)
5. Sul service account → copia il **Client ID** numerico (es. `123456789012345678901`)
6. **Google Workspace Admin Console** (`admin.google.com`) → Sicurezza → Controlli accesso e dati → **Controlli API** → **Domain-wide delegation** → Aggiungi nuovo:
   - Client ID: quello copiato sopra
   - Scope: `https://www.googleapis.com/auth/gmail.readonly`

Tre nuovi secret da configurare nel progetto Lovable:
- `GOOGLE_SA_CLIENT_EMAIL` — l'email del service account (es. `larin-gmail-reader@progetto.iam.gserviceaccount.com`)
- `GOOGLE_SA_PRIVATE_KEY` — la private key dal JSON scaricato (campo `private_key`, comprese le righe `-----BEGIN PRIVATE KEY-----`)
- `GOOGLE_WORKSPACE_DOMAIN` — `larin.it` (per validare l'impersonation)

---

### Modifiche al codice

**File toccato**: `supabase/functions/generate-slack-progress-drafts/index.ts`

1. **Nuovo modulo helper interno** `getGmailAccessTokenForUser(userEmail)`:
   - Carica la private key dai secret e la importa con `crypto.subtle.importKey` (PKCS8)
   - Costruisce un JWT con header `RS256` + claim `iss=service_account_email`, `sub=userEmail`, `scope=gmail.readonly`, `aud=https://oauth2.googleapis.com/token`, `exp=now+1h`
   - Firma con `crypto.subtle.sign("RSASSA-PKCS1-v1_5")`
   - POST a `https://oauth2.googleapis.com/token` con `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=<jwt>`
   - Cache in memoria per 50 minuti (Map per user → token + expiry) per non rifirmare ad ogni progetto
   - Validazione: rifiuta se l'email non termina in `@${GOOGLE_WORKSPACE_DOMAIN}`

2. **Refactor `fetchGmailMessages`**:
   - Nuovo parametro opzionale `accessToken?: string`
   - Se fornito → chiama `https://gmail.googleapis.com/gmail/v1/users/me/messages` direttamente con `Authorization: Bearer ${accessToken}` (NIENTE gateway Lovable, accesso diretto)
   - Se non fornito → comportamento attuale via gateway Lovable (fallback)

3. **Nel loop progetto principale**:
   - Recupera `leader_email` dalla join `profiles` (già parzialmente disponibile)
   - Se `leader_email` finisce in `@larin.it` E i secret SA sono presenti → ottiene token impersonato e lo passa a `fetchGmailMessages`
   - Altrimenti → usa il path Lovable connector come oggi
   - Logga in telemetria `gmail_source: "service_account" | "lovable_connector" | "skipped"` per ogni progetto

4. **Aggiornamento RPC `admin_get_progress_drafts_status`**:
   - Aggiungo colonna virtuale `gmail_inbox_used` con valore `service_account:<email>` o `lovable_connector:alessandro@larin.it` o `none`, così nella tab "Stato Draft Progetti" si vede da quale inbox sono state lette le email per quel progetto

5. **UI tab "Stato Draft Progetti"** (`CronJobsMonitor.tsx`): aggiungo una mini-colonna "Inbox Gmail" che mostra l'email del PL impersonata o un badge "Alessandro (fallback)" o "—" se Gmail non è stata usata.

---

### Sicurezza e permessi

- Il service account ha potere di leggere QUALSIASI inbox `@larin.it` → la private key va trattata come segreto critico, sta solo nei secret Supabase, mai nel codice.
- **Whitelist hard-coded** del dominio: la function rifiuta di impersonare email fuori da `larin.it` anche se il DB fosse compromesso.
- Solo scope `gmail.readonly`: il SA non può inviare/cancellare/modificare email.
- Audit log: ogni impersonation viene loggata con `console.log` (visibile nei log della function) → `[gmail-impersonate] project=<id> user=<email> ok|failed`.

### Cosa NON tocco

- Connector Lovable Gmail esistente (resta come fallback per il PL non `@larin.it`)
- Logica Slack, Drive, eleggibilità progetti, schedule cron, vault CRON_SECRET
- Schema `project_update_drafts`, `projects`, `profiles`

### Riepilogo tecnico

- File modificati: `supabase/functions/generate-slack-progress-drafts/index.ts`, `src/components/dashboards/CronJobsMonitor.tsx`
- Nuova migration: aggiornamento RPC `admin_get_progress_drafts_status` per esporre l'inbox usata
- Nuovi secret richiesti: `GOOGLE_SA_CLIENT_EMAIL`, `GOOGLE_SA_PRIVATE_KEY`, `GOOGLE_WORKSPACE_DOMAIN`
- Nessuna nuova dipendenza npm: si usa `crypto.subtle` nativo Deno per RS256
- Comportamento se i secret mancano: la function continua a funzionare esattamente come oggi (fallback automatico al connettore Lovable)

### Prerequisito bloccante

Per procedere con l'implementazione mi servono i 3 secret sopra. Il primo step concreto, una volta approvato il piano, sarà chiederti via tool i tre secret e implementare il codice nello stesso passaggio. Se preferisci preparare prima il service account su Google Cloud + DWD su Workspace, ti aspetto.

