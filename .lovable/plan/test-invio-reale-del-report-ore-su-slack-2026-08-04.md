# Test invio reale del report ore su Slack

## Obiettivo
Eseguire una prova completa della funzione `send-weekly-team-hours-report`, con invio effettivo del messaggio nel canale `#larin-teamleader`, per verificare formato, menzioni e dati.

## Cosa verrà fatto
1. Invocazione manuale della Edge Function con il token cron (letto dal Vault), senza `dry_run`, così il messaggio arriva davvero su Slack.
2. Controllo dei log della funzione per verificare: aree incluse (marketing, branding, tech), numero utenti elaborati, esito chiamata Slack.
3. Verifica del messaggio ricevuto: intro con menzioni dei leader, righe per persona nel formato `• Nome — ✅ conf. · 🗓️ pianif. · 📄 contratto`, assenza del totale complessivo.
4. Se qualcosa non torna (menzioni non risolte, ore errate, formattazione), correzione della funzione e nuovo invio di prova.

## Note
- Il messaggio di prova apparirà nel canale reale: verrà indicato nel testo che si tratta di un test, in modo da non confondere i leader.
- Le settimane usate sono quelle calcolate rispetto ad oggi (settimana precedente per le confermate, successiva per le pianificate), quindi i numeri non coincideranno esattamente con quelli del lunedì mattina.

## Dettagli tecnici
- Chiamata via `net.http_post` in SQL con header `Authorization: Bearer <CRON_SECRET>` recuperato da `vault.decrypted_secrets`.
- Log letti tramite gli strumenti di logging delle Edge Function.
- Nessuna modifica di schema database prevista.
