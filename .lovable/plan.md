## Obiettivo

Estendere il webhook Make (oggi triggerato solo dai progetti che passano a "completato") per inviare automaticamente un evento di **chiusura trimestrale** per i progetti `recurring`, ogni 3 mesi calcolati dalla `start_date` del progetto, con **offset di 15 giorni** dopo ogni checkpoint (Q1, Q2, Q3, Q4…).

## Comportamento

Per ogni progetto con `billing_type = 'recurring'` e `start_date` valorizzata:

- Calcolo dei checkpoint trimestrali come: **`start_date + N * 3 mesi + 15 giorni`** (N = 1, 2, 3, …).
  - Q1 = start_date + 3 mesi + 15 giorni
  - Q2 = start_date + 6 mesi + 15 giorni
  - Q3 = start_date + 9 mesi + 15 giorni
  - …
- Quando `oggi >= checkpoint` e non è già stato inviato il trigger per quel N, invio al webhook Make lo stesso payload usato oggi per il completamento, con questi campi in più:
  - `event_type: "recurring_quarter_close"` (per il caso completato resta `"project_completed"` così Make può distinguerli via router)
  - `quarter_number: N` (1, 2, 3, …)
  - `quarter_label: "Q{N}"`
  - `quarter_period_start` = `start_date + (N-1) * 3 mesi` (inizio trimestre operativo)
  - `quarter_period_end` = `start_date + N * 3 mesi` (fine trimestre operativo)
  - `quarter_trigger_date` = checkpoint effettivo (fine trimestre + 15 giorni)
- Se un progetto recurring ha `end_date` valorizzata, mi fermo ai checkpoint il cui trimestre operativo ricade entro `end_date`.
- Se un progetto è `project_status = 'completato'`, i quarter successivi al completamento non vengono inviati.

Il webhook già configurato in Impostazioni → Integrazioni (chiave `make_webhook_project_completed`) viene riusato: nessun secondo URL da configurare.

## Idempotenza

Nuova tabella `project_quarter_webhook_log`:

```
project_id uuid
quarter_number int
sent_at timestamptz
webhook_status int
PK (project_id, quarter_number)
```

Il job invia solo i checkpoint mancanti dal log → sicuro anche se rilanciato più volte.

## Componenti da toccare

1. **Migrazione DB**
   - Nuova tabella `project_quarter_webhook_log` con GRANT + RLS (service_role in scrittura, admin in lettura per debug).

2. **Edge function esistente `project-completed-webhook`**
   - Aggiungo `event_type: "project_completed"` al payload (retrocompatibile).

3. **Nuova edge function `send-recurring-quarter-webhook`**
   - Legge tutti i progetti `billing_type = 'recurring'` con `start_date` non nulla e `project_status != 'completato'`.
   - Per ognuno calcola i checkpoint dovuti (con offset +15gg) fino a `oggi`.
   - Confronta con `project_quarter_webhook_log` e per ogni N mancante:
     - Compone il payload (stessa fetch dati di project-completed-webhook: cliente, contatto, account, project leader) + campi trimestre.
     - POST al webhook Make.
     - Insert in `project_quarter_webhook_log` con stato HTTP.
   - Autenticazione: `CRON_SECRET` (pattern già usato).

4. **Cron job**
   - Schedulato **una volta al giorno alle 08:00 Europe/Rome** via `pg_cron` + `pg_net`, chiama la nuova edge function con `CRON_SECRET`.

## Fuori scope

- UI in Impostazioni: nessun cambiamento, l'URL Make è già configurato.
- Modifica del trigger di completamento esistente (resta invariato salvo l'aggiunta di `event_type`).
- Notifiche in-app / Slack per i quarter close (solo Make).
