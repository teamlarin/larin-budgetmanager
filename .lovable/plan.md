## Problema

L'errore "Edge Function returned a non-2xx status code" sulla creazione cartella Drive è causato dal log dell'edge function `google-drive-folders`:

```
403 ACCESS_TOKEN_SCOPE_INSUFFICIENT
method: google.apps.drive.v3.DriveFiles.Create
```

Il token Google attualmente memorizzato per l'utente ha solo lo scope `https://www.googleapis.com/auth/drive.readonly`, che permette di leggere/elencare le cartelle ma **non** di crearne di nuove.

In `supabase/functions/google-calendar-auth/index.ts` (linee 59-63), gli scope richiesti in fase di OAuth sono:
- `calendar.readonly`
- `calendar.events.readonly`
- `drive.readonly` ← troppo restrittivo

## Soluzione

### 1. Aggiornare gli scope OAuth
In `supabase/functions/google-calendar-auth/index.ts`, sostituire `drive.readonly` con `drive.file`.

Lo scope `drive.file` è il più sicuro:
- consente di creare cartelle e file
- consente di leggere/scrivere solo i file creati dall'app o esplicitamente aperti tramite picker
- non richiede verifica Google "restricted scope"

Se invece serve poter leggere/scrivere qualsiasi cartella del drive condiviso (anche quelle non create dalla nostra app — probabile, dato che la cartella padre "Clienti" è preesistente), occorre lo scope più ampio `https://www.googleapis.com/auth/drive`. Questo è uno "sensitive scope" e in produzione richiederà verifica OAuth da parte di Google, ma funziona subito in fase di test/interno.

**Raccomandato per questo caso d'uso (creare sottocartelle dentro un drive condiviso esistente): `https://www.googleapis.com/auth/drive`.**

### 2. Forzare il re-consent
Tutti gli utenti già connessi continueranno ad avere il vecchio token con scope `drive.readonly`. Devono ri-connettere Google da Profilo / Impostazioni per ottenere un token con il nuovo scope. Il flow ha già `prompt=consent`, quindi basterà cliccare di nuovo su "Connetti Google".

### 3. Migliorare il messaggio d'errore frontend
Nel componente che chiama l'action `create-folder` (richiamato dalla UI "Crea cartella Drive automaticamente" nel progetto), intercettare il 403 con `ACCESS_TOKEN_SCOPE_INSUFFICIENT` e mostrare un toast chiaro tipo:

> "Permessi Google insufficienti per creare cartelle. Vai in Profilo → riconnetti Google Calendar/Drive."

## File da modificare

- `supabase/functions/google-calendar-auth/index.ts` — aggiornare array `scopes` (riga 59-63)
- (Opzionale) `supabase/functions/google-drive-folders/index.ts` — restituire un errore 200 con `code: "SCOPE_INSUFFICIENT"` invece di propagare il 403, così il frontend può gestirlo
- (Opzionale) il componente che lancia "crea cartella" — gestire il nuovo codice errore

## Domanda

Quale scope preferisci?
1. **`drive.file`** — più sicuro ma può creare cartelle solo dentro contesti aperti dall'app (potrebbe non funzionare per cartelle pre-esistenti)
2. **`drive`** — accesso completo al Drive dell'utente, funziona in tutti i casi, in produzione richiede verifica Google

Per il vostro caso d'uso (creare sotto-cartelle dentro un drive condiviso aziendale già linkato) consiglio l'opzione 2.
