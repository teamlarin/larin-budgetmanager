## Problema

SUB4305 risulta `not verified` perché Fatture in Cloud invia la verifica come **GET** con header `x-fic-verification-challenge` (o query string), e si aspetta una risposta JSON `{"verification": "<token>"}`. Il nostro webhook attuale gestisce solo il vecchio param `validationToken` su GET, quindi l'handshake non si completa mai.

## Modifiche

### 1. `supabase/functions/fatture-in-cloud-webhook/index.ts`
Sul `GET`: leggere `x-fic-verification-challenge` da header e da query string e rispondere `{ "verification": <challenge> }` con status 200. Mantenere fallback `validationToken` per retro-compatibilità.

### 2. `supabase/functions/fatture-in-cloud-register-webhook/index.ts`
Aggiungere nuova action `verify` (parametro `subscriptionId`) che chiama `POST /c/{company_id}/subscriptions/{subscriptionId}/verify` di FIC per richiedere un nuovo tentativo di verifica senza dover eliminare/ricreare la subscription. Aggiornare lo Zod schema.

### 3. `src/components/FattureInCloudIntegration.tsx`
- Aggiungere mutation `verifyMutation` che invoca l'action `verify`.
- Per ogni subscription non verificata mostrare un bottone "Riprova verifica" (oltre al cestino).
- Aggiornare l'Alert: spiegare che cliccando "Riprova verifica" FIC invierà un nuovo challenge (max 5 tentativi, uno ogni 10 minuti). In alternativa eliminare e riattivare.

## Test

Dopo il deploy: cliccare "Riprova verifica" su SUB4305 → il webhook risponde al challenge → badge passa a `verified` e gli eventi suppliers create/update/delete iniziano ad arrivare.
