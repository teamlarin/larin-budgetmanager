# Fix errore "getAuthorizationDetails" nel consenso OAuth MCP

## Diagnosi (verificata)
- La pagina `/.lovable/oauth/consent` (`src/pages/OAuthConsent.tsx`) chiama `supabase.auth.oauth.getAuthorizationDetails(...)`.
- Il progetto usa `@supabase/supabase-js@^2.74.0`, che al suo interno include `@supabase/auth-js@2.74.0`.
- Verificato leggendo `node_modules/@supabase/auth-js/dist/module/GoTrueClient.d.ts@2.74.0`: **non contiene** la property `oauth` sul client Auth.
- Nella versione `@supabase/auth-js@2.110.9` (bundlata da `@supabase/supabase-js@2.110.9`) esiste invece `oauth: AuthOAuthServerApi;` con i metodi privati `_getAuthorizationDetails`, `_approveAuthorization`, `_denyAuthorization`.
- Conseguenza: a runtime `supabase.auth.oauth` è `undefined` → l'accesso a `.getAuthorizationDetails` genera l'errore mostrato da Claude durante il collegamento MCP.

## Modifica proposta
1. Aggiornare la dipendenza in `package.json`:
   - `@supabase/supabase-js`: da `^2.74.0` a `^2.110.9` (ultima stabile).
2. Reinstallare/lockfile aggiornati automaticamente.
3. Nessuna modifica a `OAuthConsent.tsx`: il wrapper tipizzato locale (`supabase.auth as { oauth: OAuthApi }`) resta compatibile con il namespace reale esposto dalla nuova versione.
4. Nessuna modifica a `src/lib/mcp/index.ts` (issuer, tools) né alla Edge Function `mcp`.

## Verifica post-fix
- Ricaricare `/.lovable/oauth/consent?authorization_id=...` dal flusso Claude → deve mostrare il card "Autorizza / Rifiuta" senza l'errore.
- Confermare "Autorizza" → redirect a Claude e connessione MCP completata.
- Controllo build TypeScript automatico (nessun cambiamento API sul supabase client per il resto del codice).

## Rischi / rollback
- Rischio minimo: upgrade minore all'interno dello stesso major (2.x). Le API `supabase.from`, `supabase.auth.getSession`, realtime, storage restano stabili tra 2.74 e 2.110.
- Rollback: ripristinare la versione precedente in `package.json` se emergono regressioni.
