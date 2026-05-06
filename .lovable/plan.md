# Fix "Connessione negata da secure.fattureincloud.it"

## Causa

L'errore non è un problema di rete: `secure.fattureincloud.it` (la pagina di login FIC) invia header `X-Frame-Options: DENY` / `Content-Security-Policy: frame-ancestors`, quindi **rifiuta di essere caricato dentro un iframe**.

La preview di Lovable (e il dominio pubblicato visualizzato in anteprima) è renderizzata in iframe. Quando in `FattureInCloudIntegration.tsx` facciamo:

```ts
onSuccess: (data) => { window.location.href = data.authUrl; }
```

il browser tenta di navigare l'iframe verso `secure.fattureincloud.it` → bloccato → messaggio "Connessione negata".

In produzione standalone (browser.it/budget.larin.it aperto direttamente, non in iframe) funzionerebbe, ma è meglio risolverlo in modo robusto per tutti i contesti.

## Soluzione

Aprire l'URL di autorizzazione in una **nuova scheda di livello top** (`window.open(url, '_blank')` con `noopener`) e, quando siamo dentro un iframe, forzare comunque il top-level. Inoltre il callback OAuth (`?fic_connected=true`) deve atterrare nella scheda principale dell'app, non nella preview iframe — quindi l'`appUrl` passato a `get-auth-url` dovrebbe essere quello visibile all'utente in produzione, non `window.location.origin` dell'iframe.

### Modifiche a `src/components/FattureInCloudIntegration.tsx`

1. Sostituire la redirect con apertura in nuova scheda:
   ```ts
   onSuccess: (data) => {
     const w = window.open(data.authUrl, '_blank', 'noopener,noreferrer');
     if (!w) {
       // Popup bloccato → fallback: prova a navigare il top frame
       try { window.top!.location.href = data.authUrl; }
       catch { window.location.href = data.authUrl; }
     }
   }
   ```
2. Calcolare `appUrl` usando `window.top?.location.origin` quando accessibile, altrimenti fallback all'URL pubblicato (`https://budget.larin.it/settings`) per evitare di tornare nell'iframe.
3. Aggiungere un piccolo `Alert` informativo: "Si aprirà una nuova scheda per autorizzare Fatture in Cloud. Al termine torna in questa pagina e clicca Aggiorna."

### Nessuna modifica server-side

`fatture-in-cloud-oauth/index.ts` resta invariato: il callback redirect funziona già correttamente, semplicemente atterrerà nella nuova scheda dove l'utente potrà chiuderla o tornare all'app.

## File toccati

- `src/components/FattureInCloudIntegration.tsx`
