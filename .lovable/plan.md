# Report Slack settimanale ore per team (#larin-teamleader)

Ogni lunedì mattina alle 8:30 (ora di Roma) arriva su Slack nel canale `#larin-teamleader` un messaggio con, per ogni area (Marketing, Branding, Tech) e per ogni persona del team:

- ore **confermate** nella settimana precedente (lun-dom)
- ore **pianificate** nella settimana successiva (la settimana che inizia quel lunedì)

## Contenuto del messaggio

```text
📊 Report ore team — settimana 27/07-02/08 → 03/08-09/08

*MARKETING*                    Confermate   Pianificate
 Mario Rossi                      32h 30m       38h 00m
 Giulia Bianchi                   28h 15m       30h 00m
 ─ Totale area                    60h 45m       68h 00m

*BRANDING* ...
*TECH* ...

Totale complessivo: 180h 30m confermate · 205h 00m pianificate
```

Note:
- Le persone senza ore in nessuna delle due settimane vengono elencate con `0h` (così si vede subito chi non ha pianificato) — se preferisci nasconderle, si cambia in una riga.
- Le aree considerate sono solo quelle indicate: marketing, branding, tech (dall'area assegnata al profilo utente).
- Vengono esclusi utenti non approvati o eliminati.

## Come vengono calcolate le ore

- **Confermate**: somma delle durate degli slot in `activity_time_tracking` con orario reale registrato (`actual_start_time`/`actual_end_time`) con `scheduled_date` nella settimana precedente.
- **Pianificate**: somma delle durate previste (`scheduled_start_time` → `scheduled_end_time`) con `scheduled_date` nella settimana successiva.
- Gestione del passaggio di mezzanotte e troncamento dei timestamp come già fatto nel resto dell'app.

## Dettagli tecnici

1. **Nuova Edge Function `send-weekly-team-hours-report`**
   - Auth con `CRON_SECRET` come Bearer (come le altre cron function).
   - Client Supabase con service role; query paginate (`.range()`) su `activity_time_tracking` per evitare il limite di 1000 righe.
   - Aggregazione per `user_id`, join con `profiles` (id, first_name, last_name, area, approved, deleted_at) — nessuna colonna di compenso.
   - Invio Slack via connector gateway (`https://connector-gateway.lovable.dev/slack/api/chat.postMessage`) con `LOVABLE_API_KEY` + `SLACK_API_KEY`, canale `#larin-teamleader`, blocchi Slack Block Kit.
   - Gestione errori: log di status e body della risposta Slack, controllo di `ok: false`.
   - Supporto parametro opzionale `{ "dry_run": true }` per generare il testo senza inviarlo (utile per il test).

2. **Cron job** (via tool insert, non migrazione, perché contiene URL e chiave):
   - Due schedulazioni `30 6 * * 1` e `30 7 * * 1` (UTC), con guardia nella function che invia solo se l'ora locale di Roma è 8 — così l'orario resta 8:30 sia con ora solare che legale.

3. Nessuna modifica al database e nessuna modifica UI.
