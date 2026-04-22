

## Fix collegamento Slack (errore "Edge Function returned a non-2xx status code")

### Diagnosi

Il connector Slack **TimeTrap** è installato nel workspace con tutti gli scope giusti (`channels:read`, `channels:history`, `groups:read/history`, `users:read`), ma **non è collegato a questo progetto**. Risultato: nelle Edge Functions la variabile `SLACK_API_KEY` non esiste, `list-slack-channels` risponde HTTP 400 con `{ code: "slack_not_connected" }`, ma il client mostra il messaggio generico "Errore di sincronizzazione Slack — Edge Function returned a non-2xx status code" perché `supabase.functions.invoke` non rende disponibile il body delle risposte non-2xx in modo affidabile.

### Cosa farò

**1. Collegare il connector Slack al progetto**
Uso `standard_connectors--connect` con `connector_id: slack`. Apparirà un prompt per confermare la connessione esistente "TimeTrap"; una volta confermata, `SLACK_API_KEY` e `LOVABLE_API_KEY` saranno disponibili nelle Edge Functions.

**2. Migliorare la robustezza degli errori nelle Edge Functions Slack**
Modifico `list-slack-channels` e mantengo coerenza con `verify-slack-channel`: quando l'errore è "logico" (Slack non connesso, scope mancante, canale non valido) restituiscono **HTTP 200** con `{ ok: false, code, message }` invece di 400/502. Solo errori realmente imprevisti restano 5xx. Così il client riesce sempre a leggere il body strutturato.

**3. Allineare il client (`ProjectSlackChannelPicker`)**
Aggiorno `useQuery` per `list-slack-channels`:
- consumare il nuovo formato `{ ok: false, code, message }`
- mantenere un fallback per `error.context.body` (per retro-compatibilità)
- mostrare l'alert tipizzato (titolo + CTA "Come risolvere" / "Riprova") anche dentro al dialog di selezione canale

**4. Ridistribuire le Edge Functions**
Dopo la modifica, deploy di `list-slack-channels` e `verify-slack-channel`.

### File toccati

- (link connector) — nessun file, azione tramite `standard_connectors--connect`
- `supabase/functions/list-slack-channels/index.ts` — restituire 200+`ok:false` per errori prevedibili
- `supabase/functions/verify-slack-channel/index.ts` — già usa lo schema `ok/code`, piccolo allineamento se necessario
- `src/components/ProjectSlackChannelPicker.tsx` — gestione robusta del nuovo schema di risposta + alert in-dialog

### Risultato atteso

- Cliccando "Collega canale" l'elenco dei canali si carica correttamente.
- Se Slack venisse scollegato/perdesse scope, l'utente vede un alert chiaro tipizzato ("Slack non collegato" / "Permessi insufficienti") con il pulsante "Come risolvere" invece del messaggio criptico attuale.

