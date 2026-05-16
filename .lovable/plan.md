# Integrazione JetHr → TimeTrap (via Google Calendar)

JetHr scrive gli eventi di assenza nel Google Calendar dell'utente. TimeTrap già legge i Google Calendar collegati: aggiungiamo riconoscimento + auto-conversione in attività pianificate sul progetto "Larin OFF", con notifica Slack su un canale globale.

## 1. Riconoscimento eventi JetHr

L'edge function `google-calendar-events` oggi scarta diversi campi utili. Estenderemo il mapping per esporre anche:
- `organizer` (email + displayName)
- `creator` (email + displayName)
- `source` (title/url se presente)

Un evento è considerato "JetHr" se **almeno uno** è vero:
1. `organizer.email` o `creator.email` matcha un pattern configurabile (default: `*@jethr.com`, `*@jethr.io`, `noreply@jethr*`).
2. `description` o `summary` contiene il marker "jethr" (case-insensitive) o un'URL `jethr.com`.

Pattern e marker sono salvati in `app_settings` (`jethr_detection`) e modificabili dall'admin.

## 2. Mapping tipo assenza → attività progetto OFF

Nuova tabella `jethr_absence_mappings`:

| campo | descrizione |
|---|---|
| `keyword` | stringa case-insensitive cercata nel titolo dell'evento (es. "ferie", "permesso", "malattia", "ROL") |
| `budget_item_id` | FK all'attività del progetto OFF (es. "Ferie", "Permesso", "Malattia") |
| `priority` | ordine di valutazione (la prima keyword che matcha vince) |
| `is_default` | fallback se nessuna keyword matcha |

UI in `IntegrationsTab.tsx` → nuovo card "JetHr (Assenze)" con:
- pattern di rilevamento
- canale Slack
- toggle on/off
- gestione mapping keyword → attività (select tra le `budget_items` del progetto OFF)

Le keyword sono valutate per priorità; se nessuna matcha si usa il mapping `is_default`. Se non c'è default, l'evento viene ignorato e loggato.

## 3. Conversione automatica in `activity_time_tracking`

Il calendario di TimeTrap già renderizza gli eventi Google: aggiungiamo un passo di "auto-link" backend.

Nuovo edge function `jethr-auto-link-events` (eseguito da cron ogni ~10 min, e on-demand dal pulsante "Sincronizza ora"):
1. Per ogni utente con `user_google_tokens` valido, legge gli eventi degli ultimi 7 giorni / prossimi 90 giorni dai calendari selezionati (riusa la logica di `google-calendar-events`).
2. Filtra quelli "JetHr" secondo la regola al §1.
3. Per ognuno:
   - Se esiste già una riga in `activity_time_tracking` con `google_event_id = event.id` → skip (idempotenza).
   - Risolve il `budget_item_id` via mapping (§2). Se manca → skip + log.
   - Crea la riga `activity_time_tracking` con:
     - `user_id` = utente proprietario del calendario
     - `budget_item_id` = mappato
     - `scheduled_date`, `scheduled_start_time`, `scheduled_end_time` derivati dall'evento (eventi all-day → 09:00-18:00 del giorno, configurabile)
     - `actual_start_time` / `actual_end_time` = stessi valori (conferma automatica, in linea con il pattern "Larin OFF" → confermato di default)
     - `google_event_id` = `event.id`
     - `google_event_title` = `event.summary`
     - `notes` = `[JetHr] {description ridotta}`
     - `confirmed = true`
4. Accoda una notifica Slack (§4) per ogni nuova creazione.

Eventi multi-giorno → una riga `activity_time_tracking` per ciascun giorno (rispetta `useClosureDays` per saltare giorni di chiusura aziendale).

## 4. Notifica Slack

- Canale globale configurato in `app_settings.jethr_slack_channel` (es. `#assenze-jethr`).
- Notifica inviata via `send-slack-notification` (già esistente) all'atto della creazione delle righe.
- Una sola notifica per assenza contigua (raggruppa per `user + start_date + end_date + tipo`), con messaggio del tipo:
  > 🌴 *Mario Rossi* — Ferie dal *Lun 18 mag* al *Ven 22 mag* (5 giorni). _Da JetHr._

## 5. Cron

Nuovo job `jethr-auto-link-every-10min` (`*/10 * * * *`) che chiama `jethr-auto-link-events` con `CRON_SECRET` (rispetta la convenzione esistente).

## 6. UI

- `IntegrationsTab.tsx`: nuovo card **JetHr** con:
  - Stato attivo/inattivo
  - Pattern di rilevamento (email + keyword), tabella mapping keyword→attività, selettore canale Slack, orari di default per all-day, pulsante "Sincronizza ora", ultimo run.
- `CalendarGrid.tsx` / `GoogleCalendarEvent.tsx`: badge "JetHr" sugli eventi rilevati (anche prima della conversione), per chiarezza utente.

## 7. Database (migration)

- `app_settings` rows: `jethr_enabled`, `jethr_detection` (jsonb), `jethr_slack_channel`, `jethr_default_times` (jsonb `{start, end}`).
- Tabella `jethr_absence_mappings(id, keyword, budget_item_id FK budget_items, priority int, is_default bool, created_at)` + RLS (solo admin in scrittura, lettura per ruoli autenticati).
- Tabella `jethr_auto_link_log(id, user_id, google_event_id, status, error, created_at)` per audit/idempotenza.

## 8. Sicurezza

- Tutte le edge functions chiamate da cron richiedono `CRON_SECRET` come Bearer (memory rule).
- RLS sulle nuove tabelle: admin scrive, ruoli autenticati leggono (mappings); log visibile solo agli admin.
- Nessun token JetHr coinvolto: l'integrazione è 100% via Google Calendar dell'utente (già esistente).

## Out of scope (per ora)

- Cancellazione/aggiornamento di una richiesta JetHr → al momento se l'evento Google scompare, la pianificazione resta. Possibile estensione futura: marcare `deleted_at` quando l'evento non è più presente.
