
Correggerò il flusso OAuth di `supabase/functions/fatture-in-cloud-oauth/index.ts` perché il nuovo guard `req.method !== 'POST'` è troppo rigido: oggi accetta solo il callback di successo (`code` + `state`) e rifiuta tutti gli altri `GET`, ma Fatture in Cloud può tornare anche con parametri di errore o callback incompleti.

Piano:
1. Gestire esplicitamente tutti i callback `GET`
   - Se arrivano `code` + `state`, mantenere il flusso attuale di exchange token.
   - Se arriva `error`, fare redirect verso `/settings` con un parametro tipo `fic_error=...` invece di rispondere JSON `Method not allowed`.
   - Se arriva un `GET` senza body e senza callback valido, rispondere con un redirect sicuro alla pagina impostazioni con errore generico, non con 405 JSON.

2. Limitare il parsing JSON solo alle vere chiamate API
   - Lasciare `req.json()` solo per richieste `POST`.
   - Tenere il `try/catch` sul body, ma usarlo solo dopo aver escluso tutti i casi OAuth `GET`.

3. Migliorare il feedback lato frontend in `src/components/FattureInCloudIntegration.tsx`
   - Oltre a `fic_connected=true`, leggere anche `fic_error` nei query params.
   - Mostrare un toast leggibile in caso di autorizzazione negata o callback non valido.
   - Pulire l’URL dopo il toast come già avviene per `fic_connected`.

4. Verifica funzionale prevista
   - Click su “Collega Fatture in Cloud” deve continuare a generare l’URL OAuth.
   - Callback di successo deve tornare in `/settings?fic_connected=true`.
   - Callback con errore o consenso negato deve tornare in `/settings?fic_error=...` senza mostrare JSON grezzo.

Dettaglio tecnico:
- Il problema non è più CORS né autenticazione: dai log `get-auth-url` funziona correttamente.
- Il 405 nasce perché la function tratta ogni `GET` non perfettamente valido come richiesta API, mentre in un flusso OAuth i `GET` di ritorno vanno gestiti come navigazione browser e chiusi con redirect HTML/302.
