

## Fix: Errore connessione Fatture in Cloud

### Problema identificato

Le edge functions `fatture-in-cloud-oauth` e `fatture-in-cloud-register-webhook` hanno CORS headers incompleti. Mancano gli header che il client Supabase JS invia automaticamente (`x-supabase-client-platform`, etc.), causando il blocco delle richieste da parte del browser.

La function `fatture-in-cloud-send-quote` (creata recentemente) ha gia' gli header corretti.

### Inoltre: scope OAuth insufficiente

Lo scope OAuth attuale e' `entity.suppliers:a settings:a`. Per supportare l'invio preventivi serve anche `issued_documents:a`.

### Modifiche

**1. `supabase/functions/fatture-in-cloud-oauth/index.ts`** (riga 6)
- Aggiornare CORS headers aggiungendo: `x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version`
- Aggiornare scope OAuth da `entity.suppliers:a settings:a` a `entity.suppliers:a settings:a issued_documents:a` (riga 174)

**2. `supabase/functions/fatture-in-cloud-register-webhook/index.ts`** (riga 6)
- Aggiornare CORS headers con gli stessi header mancanti

