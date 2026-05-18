## Stato attuale

La sync `jethr-auto-link-events` gira già ogni 10 min e ha auto-creato decine di righe `activity_time_tracking` per eventi "Ferie" reali (utenti diversi, date da maggio ad agosto 2026). Configurazione e mappature sono OK. Tre problemi rilevati nei dati prodotti.

## Bug da correggere prima del test

### Bug 1 — Eventi all-day con durata zero
Eventi tipo "Ferie" all-day vengono salvati con `scheduled_start_time = scheduled_end_time = 22:00:00`. Il parser tratta `start: "2026-08-09"` (date-only) come ISO con timezone, ottenendo 22:00 UTC del giorno precedente, e fallisce a riconoscere il flag `allDay`.

**Fix in `jethr-auto-link-events/index.ts`**: quando l'evento Google ha `allDay === true` (o quando `start`/`end` sono date-only senza `T`), usare `jethr_default_times` (09:00 → 18:00) come orari pianificati invece di parsare il timestamp.

### Bug 2 — Orari salvati in UTC anziché locali
Per eventi timed gli orari finiscono in UTC (`06:00–16:05`) anziché in `Europe/Rome` (`08:00–18:05`). Causa: si fa `new Date(iso).getUTCHours()` invece di estrarre l'ora locale dell'offset già presente nell'ISO Google (`+02:00`).

**Fix**: parsare l'ISO mantenendo l'offset originale e formattare `HH:mm` usando l'offset, non `getUTCHours()`. In pratica: leggere direttamente la sottostringa `T(HH:mm)` dall'ISO Google quando contiene un offset, oppure usare `date-fns-tz` con timezone fissa `Europe/Rome`.

### Bug 3 — Refresh token revocato
Almeno un utente ha refresh_token Google non più valido (account cancellato/scope revocato). Attualmente la funzione logga l'errore e continua, ma non lo segnala.

**Fix**: catturare `invalid_grant`, marcare la sessione Google di quell'utente come scaduta in `google_calendar_tokens` (o equivalente) ed evitare di ritentarlo ad ogni run finché non si riconnette. Aggiungere riga di log con `user_id` e motivo.

## Pulizia dati esistenti

Prima di rilanciare la sync con i fix, ripulire:
- DELETE da `activity_time_tracking` per le righe con `google_event_id IN (SELECT google_event_id FROM jethr_auto_link_log)` e `scheduled_start_time = scheduled_end_time` **OPPURE** `scheduled_start_time = '06:00:00'` (sospette UTC)
- TRUNCATE `jethr_auto_link_log` corrispondente per permettere il re-link

Faccio una migrazione SQL parametrizzata e ti mostro l'anteprima dei record che verrebbero eliminati **prima** di applicarla.

## Test end-to-end

1. Disattivare temporaneamente il cron (`jethr_enabled = false` o pause cron) per evitare doppi run
2. Tu crei un evento "Ferie test" nel tuo Google Calendar (1 giorno all-day + 1 evento timed 10:00–11:00)
3. Lancio manualmente la edge function via `curl_edge_functions` con `CRON_SECRET`
4. Verifico:
   - 2 righe in `activity_time_tracking` con orari corretti (all-day → 09:00-18:00, timed → 10:00-11:00 locali)
   - 2 entry in `jethr_auto_link_log`
   - 1 notifica su `#larin-jethr`
5. Rilancio una seconda volta → 0 nuove righe (idempotenza)
6. Cancello le 2 righe di test
7. Riattivo `jethr_enabled = true`

## Out of scope

- Non tocco la UI di configurazione
- Non modifico la logica di Slack notification (solo la rendo no-op in fase test se serve)
- Non rigenero gli eventi storici già corretti
