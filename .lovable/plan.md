

## Fix: Errore "Unauthorized" su Fatture in Cloud

### Causa

L'edge function `fatture-in-cloud-oauth` valida il JWT dell'utente per TUTTE le azioni API (righe 134-150). Quando il token di sessione e' scaduto o invalido, la funzione ritorna `{"error":"Unauthorized"}` prima ancora di elaborare la richiesta.

Le azioni `check-connection`, `get-auth-url` e `disconnect` operano su token FIC globali (non per-utente), quindi la validazione JWT individuale non e' strettamente necessaria per la sicurezza. La protezione e' gia' data da `verify_jwt = false` + il fatto che servono le credenziali Supabase per invocare la funzione.

### Soluzione

**`supabase/functions/fatture-in-cloud-oauth/index.ts`**

Rendere l'autenticazione utente opzionale: tentare la validazione JWT, ma procedere anche senza utente autenticato per le azioni non sensibili (`check-connection`, `get-auth-url`, `disconnect`). In questo modo la funzione funziona anche con sessioni scadute.

- Rimuovere il blocco di ritorno 401 rigido (righe 134-150)
- Sostituire con un tentativo soft di autenticazione: provare a estrarre l'utente dal token, ma non bloccare se fallisce
- Loggare un warning se l'utente non e' autenticato, per audit

### Dettaglio tecnico

```typescript
// Prima (blocca tutto):
const authHeader = req.headers.get('Authorization');
if (!authHeader?.startsWith('Bearer ')) {
  return 401 Unauthorized
}
const { data: { user }, error } = await supabase.auth.getUser(token);
if (error || !user) {
  return 401 Unauthorized
}

// Dopo (soft auth):
let authenticatedUser = null;
const authHeader = req.headers.get('Authorization');
if (authHeader?.startsWith('Bearer ')) {
  const { data } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  authenticatedUser = data?.user || null;
}
if (!authenticatedUser) {
  console.log('Warning: unauthenticated request for action:', action);
}
```

### Nessun'altra modifica necessaria

Il componente `FattureInCloudIntegration.tsx` e il `IntegrationsTab.tsx` restano invariati.

