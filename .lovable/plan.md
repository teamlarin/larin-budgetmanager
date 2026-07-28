## Perché fallisce

Il tool che stai collegando (dallo screenshot) supporta solo un **header Authorization statico**: non implementa il flusso OAuth 2.1 (discovery + registrazione dinamica + consenso) che l'endpoint `/functions/v1/mcp` richiede. Quindi fa POST senza bearer valido e mcp-js risponde `401 unauthorized` — nei log della funzione compare esattamente `[mcp-js] auth.no_bearer_token { outcome: "401" }` (verificato). Non è un problema di `verify_jwt` (è già `false`) né della configurazione OAuth, che con Claude funziona.

La libreria `@lovable.dev/mcp-js` espone solo `auth.oauth.issuer(...)`: non c'è un modo nativo per accettare una API key statica sullo stesso endpoint.

## Soluzione proposta

Aggiungere un **secondo endpoint MCP autenticato con le API key TimeTrap** (le stesse `tt_...` già gestite in Impostazioni → API), lasciando `/mcp` invariato con OAuth per Claude/ChatGPT.

Nuova Edge Function `mcp-key`:
1. Legge la chiave da `Authorization: Bearer tt_...` (o `X-Api-Key`), ne calcola lo SHA-256 e la valida su `api_keys` (revoca, scadenza, scope) — stessa logica già presente in `public-api`.
2. Richiede un nuovo scope `mcp:use` sulla chiave, così una chiave "solo progetti" non apre l'MCP.
3. Risolve l'utente proprietario (`api_keys.created_by`) e, con la service role key, genera un access token Supabase per quell'utente (magic link + verifyOtp lato server, mai esposto al client).
4. Inoltra la richiesta JSON-RPC alla funzione `mcp` con quel bearer, restituendo la risposta (incluso `text/event-stream`) al chiamante.

In questo modo i tool esistenti (`list_projects`, `list_time_entries`, `find_users`, ...) girano con l'identità e i permessi reali del proprietario della chiave, senza duplicare la logica.

### Modifica necessaria lato MCP

Per accettare il token di sessione inoltrato dal proxy va impostato `requireOAuthClientClaim: false` in `src/lib/mcp/index.ts`. Trade-off: da quel momento anche un access token di sessione dell'app (non solo un token OAuth) sarebbe valido sull'endpoint `/mcp`. Dato che gli account sono solo interni e i token durano 1h, lo considero accettabile; se preferisci evitarlo, l'alternativa è scrivere a mano un secondo server MCP JSON-RPC dentro `mcp-key` (più codice da mantenere, tool duplicati).

### UI

In Impostazioni → API: aggiungere lo scope `mcp:use` nella creazione chiave e, nella pagina `Connect`, una terza scheda "Altri client (API key)" con l'URL `.../functions/v1/mcp-key` e l'istruzione di incollare `Bearer tt_...` nel campo Header Authorization.

## Alternativa rapida (senza sviluppo)

Se ti serve solo provare subito: molti di questi client accettano un bearer statico — potresti incollare un access token Supabase valido, ma scade in un'ora e comunque richiede lo stesso `requireOAuthClientClaim: false`. Non è una soluzione stabile.

## File toccati

- `supabase/functions/mcp-key/index.ts` (nuovo, `verify_jwt = false` in `supabase/config.toml`)
- `src/lib/mcp/index.ts` (`requireOAuthClientClaim: false`) + redeploy `mcp`
- `src/components/ApiKeysManagement.tsx` (scope `mcp:use`)
- `src/pages/Connect.tsx` (istruzioni nuovo endpoint)
