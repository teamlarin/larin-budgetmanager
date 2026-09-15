# Avviso quando arriva una nuova opportunità da HubSpot

## Obiettivo
Ogni volta che la sincronizzazione da HubSpot crea un nuovo budget in bozza, far arrivare ad Alessandro (alessandro@larin.it) una email e una notifica dentro TimeTrap.

## Comportamento
- Vale solo per i budget **nuovi**: se la sincronizzazione aggiorna un budget già esistente non arriva nulla.
- Le trattative nella lista delle esclusioni continuano a essere ignorate, quindi non generano avvisi.
- Un solo avviso per ogni giro di sincronizzazione:
  - **Email**: oggetto "Nuova opportunità da HubSpot", con l'elenco delle trattative create (nome trattativa, azienda, importo, area, data di chiusura prevista) e il link alla sezione Budget.
  - **Notifica in app**: campanella per Alessandro, titolo "Nuove opportunità da HubSpot" e testo con quante e quali trattative sono entrate.
- Se non viene creato nessun budget, nessuna email e nessuna notifica.

## Dettagli tecnici
- `supabase/functions/sync-budget-drafts/index.ts`: raccogliere in un array le righe effettivamente inserite (nome, azienda, importo, area, data chiusura) durante il ciclo; a fine ciclo, se l'array non è vuoto:
  - email tramite `sendEmail` da `../_shared/mandrill.ts` (`from_email: noreply@timetrap.it`, `from_name: TimeTrap`), HTML con lo stesso wrapper visivo usato in `send-budget-notification`;
  - notifica: `insert` in `notifications` con `type: 'hubspot_new_opportunity'`, `title`, `message`, `read: false`, `project_id: null` (la colonna ha FK verso `projects`, quindi non può contenere l'id del budget).
- Destinatario risolto per email da `profiles` (`email = 'alessandro@larin.it'`, non eliminato) per ricavare l'`user_id` della notifica; se il profilo non esiste, invio comunque la sola email e log dell'anomalia.
- Errori di invio email/notifica gestiti in try/catch e loggati: non devono far fallire la sincronizzazione.
- Il risultato della funzione riporta anche `notification_sent: true|false`.
- Nessuna migrazione database necessaria.
- Deploy di `sync-budget-drafts` al termine.
