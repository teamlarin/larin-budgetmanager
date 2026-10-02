# Task da Slack con reazione 📌

## Come funziona per il team
1. In un canale Slack collegato a un progetto TimeTrap, qualcuno aggiunge la reazione 📌 a un messaggio (anche dentro un thread).
2. TimeTrap legge il messaggio (e, se è in un thread, il messaggio iniziale per il contesto) e crea una task nel progetto collegato a quel canale:
   - **Titolo**: sintetizzato dall'AI (verbo + oggetto), descrizione con il testo originale e il link al messaggio Slack.
   - **Assegnatario**: chi ha messo la 📌 (riconosciuto tramite email Slack = email TimeTrap). Se nel messaggio è citata una persona del team (@nome), viene assegnata a lei.
   - **Scadenza**: solo se il messaggio la cita chiaramente ("entro venerdì").
   - **Attività a budget**: quella più coerente scelta dall'AI tra le attività del progetto; se il progetto ne ha una sola, quella.
   - **Stato**: Da fare.
3. Il bot risponde nel thread: "Task creata: <titolo> → assegnata a X · Apri in TimeTrap".
4. Nessun duplicato: una seconda 📌 sullo stesso messaggio non crea un'altra task (risponde con il link a quella esistente).
5. Casi gestiti con risposta nel thread: canale non collegato a nessun progetto, utente Slack non riconosciuto in TimeTrap, progetto senza attività a budget.

## Cosa serve da parte tua (una volta sola)
L'attuale collegamento Slack di TimeTrap può solo inviare messaggi, non ricevere eventi come le reazioni. Serve una piccola **app Slack dedicata "TimeTrap"**:
1. Ti fornisco un file di configurazione già pronto (manifest) da incollare su api.slack.com/apps → "Create from manifest".
2. La installi nel workspace e mi copi due codici: **Bot Token** e **Signing Secret** (li salvo in modo sicuro).
3. Inviti il bot `@TimeTrap` nei canali privati dei progetti (i pubblici sono automatici).

Le notifiche Slack esistenti (aggiornamenti, chiusure, bozze) restano invariate.

## Dettagli tecnici
- Nuova Edge Function `slack-events` (verify_jwt = false): gestisce `url_verification`, ignora i retry (`x-slack-retry-num`), verifica la firma HMAC sul body grezzo con `SLACK_SIGNING_SECRET`, risponde 200 subito e lavora in `EdgeRuntime.waitUntil`.
- Evento `reaction_added` con `reaction` in (`pushpin`, `round_pushpin`); recupero messaggio con `conversations.replies`/`conversations.history`, utente con `users.info` (email) via `SLACK_BOT_TOKEN`.
- Progetto: `projects.slack_channel_id = event.item.channel` (progetti approvati, non chiusi).
- Utente: `profiles.email` = email Slack → creatore e assegnatario.
- Estrazione AI (titolo, scadenza, attività, eventuale assegnatario) con lo stesso schema strutturato già usato in `extract-tasks-from-transcript`; ID validati contro team e attività del progetto.
- Migrazione: colonne `project_tasks.source` (text, default null) e `source_ref` (text, es. `slack:<channel>:<ts>`) con indice unico parziale su `source_ref` per l'idempotenza.
- Insert con service role + `project_task_assignees`; le notifiche di assegnazione esistenti partono dai trigger già presenti.
- Risposta nel thread con `chat.postMessage` (`thread_ts`).
- Manifest Slack con scope bot: `reactions:read`, `channels:history`, `groups:history`, `chat:write`, `users:read`, `users:read.email`; evento `reaction_added`; Request URL = URL della funzione `slack-events`.
- Secrets richiesti: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` (richiesti dopo la creazione dell'app).

## Fuori perimetro (eventuale fase 2)
- Creazione task da email/Gmail.
- Scelta interattiva dell'attività con pulsanti Slack quando l'AI non è sicura.
