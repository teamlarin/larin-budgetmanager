

## Fix: Errore `invalid_request` da Fatture in Cloud

### Analisi dai log

I log mostrano che:
1. `get-auth-url` genera correttamente l'URL OAuth
2. L'utente viene redirezionato a FIC
3. FIC **rifiuta immediatamente** la richiesta e ritorna `error=invalid_request`
4. Il nostro handler GET cattura l'errore e redireziona a `/settings?fic_error=invalid_request`

L'errore `invalid_request` viene da Fatture in Cloud, non dal nostro codice. Significa che uno dei parametri OAuth è invalido.

### Cause probabili (in ordine di probabilità)

1. **Redirect URI non corrispondente** — La `redirect_uri` inviata (`https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/fatture-in-cloud-oauth`) deve corrispondere **esattamente** a quella registrata nel portale sviluppatori di Fatture in Cloud. Anche una differenza minima (trailing slash, http vs https) causa `invalid_request`.

2. **Encoding del parametro `state`** — Il codice usa `btoa()` che produce base64 standard con caratteri `+`, `/` e padding `=`. Questi vengono URL-encoded da `URLSearchParams`, ma alcuni provider OAuth li rifiutano. Possiamo usare base64 URL-safe.

### Piano

#### Passo 1: Verifica configurazione FIC (azione dell'utente)
Accedi al portale sviluppatori di Fatture in Cloud e verifica che la **Redirect URI** registrata sia esattamente:
```
https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/fatture-in-cloud-oauth
```
Senza trailing slash, con HTTPS.

#### Passo 2: Migliorare encoding dello state (modifica codice)
**`supabase/functions/fatture-in-cloud-oauth/index.ts`** — Sostituire `btoa()` con base64 URL-safe (senza `+`, `/`, `=`) per evitare problemi di encoding:

```typescript
// Da:
const state = btoa(JSON.stringify({...}));

// A:
const state = btoa(JSON.stringify({...}))
  .replace(/\+/g, '-')
  .replace(/\//g, '_')
  .replace(/=+$/, '');
```

Il decoder nello handler callback già gestisce URL-safe base64 (linee 39-43), quindi non servono altre modifiche.

### Dettaglio tecnico

La modifica è minima: una sola riga nel blocco `get-auth-url`. Il resto della funzione e il frontend non cambiano. Se il problema è il redirect_uri nel portale FIC, la modifica al codice da sola non basterà — serve la verifica manuale della configurazione.

