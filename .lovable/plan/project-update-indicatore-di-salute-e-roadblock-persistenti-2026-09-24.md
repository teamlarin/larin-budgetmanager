# Project Update: indicatore di salute e roadblock persistenti

Obiettivo: rendere gli aggiornamenti di progetto leggibili a colpo d'occhio e non far più perdere i blocchi tra un aggiornamento e l'altro. La suddivisione per servizi venduti resta fuori da questo intervento.

## 1. Indicatore di salute

Ogni aggiornamento porta uno stato scelto da chi lo scrive:

- Verde "In linea" — nessun ostacolo, tempi rispettati
- Giallo "Con attenzione" — rallentamento o rischio da monitorare
- Rosso "Bloccato" — il lavoro è fermo in attesa di qualcosa

Dove si vede:
- badge colorato in testa alla scheda del progetto, con la data dell'ultimo aggiornamento
- badge su ogni aggiornamento nello storico
- timeline in alto colorata secondo lo stato reale dichiarato (non più dedotto dal testo)

La percentuale di progresso resta esattamente dov'è: nel modulo di inserimento, nella testata e nelle liste.

## 2. Sintesi generale

Nel modulo di inserimento il campo di testo diventa "Sintesi": una frase breve su dove siamo, come procede la relazione con il cliente e l'andamento rispetto all'obiettivo. Nella scheda la sintesi dell'ultimo aggiornamento è mostrata in evidenza, sopra lo storico.

## 3. Roadblock come schede persistenti

I blocchi smettono di essere un semplice testo dentro un aggiornamento e diventano voci con vita propria:

- **Descrizione**: cosa sta bloccando il lavoro, in poche righe
- **Tipo**: persone, risorse, strumenti, informazioni, attenzione cliente, decisioni, dipendenze esterne
- **Aperto dal**: data di apertura, con indicazione dei giorni trascorsi per leggere subito l'urgenza
- **In attesa di**: chi deve fare cosa (facoltativo)
- **Stato**: aperto o risolto, con data di risoluzione e nota di chiusura

Comportamento:
- i blocchi aperti restano fissi in cima alla scheda del progetto, sopra lo storico, finché non vengono chiusi
- pulsante "Segna come risolto" su ogni blocco; i risolti finiscono in un elenco richiudibile
- si possono aprire nuovi blocchi sia dal modulo di aggiornamento sia direttamente dalla scheda
- se esiste almeno un blocco aperto, lo stato dell'aggiornamento non può essere verde: viene proposto giallo o rosso
- i blocchi già scritti come testo negli aggiornamenti esistenti vengono convertiti in schede aperte, mantenendo data e testo originali

## 4. Notifica Slack

Il messaggio inviato al canale del progetto riporta lo stato di salute con il pallino colorato, la sintesi e l'elenco dei blocchi aperti con tipo e giorni di apertura.

## Dettagli tecnici

- `project_progress_updates`: nuova colonna `health_status` (`in_linea` | `attenzione` | `bloccato`, default `in_linea`).
- Nuova tabella `project_roadblocks`: `project_id`, `progress_update_id` (opzionale), `description`, `blocker_type` (enum dei 7 tipi), `waiting_on_who`, `waiting_on_what`, `opened_at`, `resolved_at`, `resolution_note`, `created_by`, timestamp standard. GRANT per `authenticated` e `service_role`, RLS allineata a `can_access_project_tasks` per la lettura e ai permessi già usati da `project_progress_updates` (admin, team leader, project leader, account) per scrittura e chiusura.
- Migrazione dati: per ogni `project_progress_updates.roadblocks_text` non vuoto, creazione di un roadblock con `blocker_type` generico e `opened_at = created_at`; il campo testo resta in tabella per storico.
- `ProgressUpdateDialog.tsx`: selettore stato di salute, campo "Sintesi", blocco ripetibile per inserire roadblock (descrizione, tipo, in attesa di).
- `progressUpdates.ts`: `publishProgressUpdate` accetta `healthStatus` e un array di roadblock da creare, e passa stato e blocchi aperti al payload Slack.
- `ProjectProgressUpdates.tsx`: header con badge di salute, pannello "Blocchi aperti" persistente con azione di risoluzione, sintesi in evidenza, timeline colorata da `health_status`, storico con badge per aggiornamento.
- `supabase/functions/send-slack-notification/index.ts`: formattazione di stato e blocchi aperti.
