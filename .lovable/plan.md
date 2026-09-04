# API progetti: Slack, Drive, cliente e contatto

Arricchire la risposta delle API pubbliche dei progetti (elenco e dettaglio) con il canale Slack collegato, la cartella Drive, i dati del cliente e quelli del contatto di riferimento.

## Cosa cambia nella risposta

Per ogni progetto vengono aggiunti:

- **slack_channel**: id e nome del canale collegato (null se non collegato), più il link diretto al canale.
- **drive_folder**: già presente (id, nome, link) — resta invariato.
- **client**: oltre a id e nome, anche email e telefono del cliente, e la sua cartella Drive se presente.
- **client_contact**: nome, cognome, nome completo, email, telefono, ruolo del contatto collegato al progetto.

Esempio di struttura restituita:

```text
{
  "id": "...",
  "name": "...",
  "slack_channel": { "id": "C0123", "name": "cliente-progetto", "url": "https://slack.com/app_redirect?channel=C0123" },
  "drive_folder": { "id": "...", "name": "...", "url": "..." },
  "client": { "id": "...", "name": "...", "email": "...", "phone": "...", "drive_folder": {...} },
  "client_contact": { "id": "...", "first_name": "...", "last_name": "...", "full_name": "...", "email": "...", "phone": "...", "role": "..." }
}
```

Se un dato manca, il campo vale `null` (nessun errore).

## Dettagli tecnici

- File: `supabase/functions/public-api/index.ts`.
- Estendere `PROJECT_SELECT` con `slack_channel_id`, `slack_channel_name`, `client_contact_id` e la join annidata:
  `client:clients(id, name, email, phone, drive_folder_id, drive_folder_name)` e
  `client_contact:client_contacts(id, first_name, last_name, email, phone, role)`.
- Aggiornare `serializeProject` per costruire i tre nuovi blocchi (`slack_channel`, `client` esteso, `client_contact`), con `full_name` calcolato da nome + cognome.
- Nessuna modifica al database e nessuna nuova RLS: la funzione usa già il service role e lo scope `projects:read`.
- Aggiornare la documentazione API in app (pagina/sezione che elenca i campi restituiti) se presente, così l'elenco dei campi resta allineato.
