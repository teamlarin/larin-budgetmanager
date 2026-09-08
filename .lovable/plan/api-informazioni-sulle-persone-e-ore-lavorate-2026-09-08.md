# API: informazioni sulle persone e ore lavorate

Oggi le API pubbliche espongono solo i progetti. Aggiungiamo le persone (anagrafica base) e le ore confermate, usando lo stesso permesso già attivo sulle chiavi (`projects:read`), senza nuovi permessi da configurare.

## Nuovi endpoint

### GET /users
Elenco delle persone con: nome, cognome, nome completo, email, ruolo/titolo, area, livello (nome e area del livello), avatar, ruoli applicativi (admin, account, finance, team leader, ecc.), attivo sì/no, data creazione.

Filtri: `area`, `role`, `active` (default: solo attive), `search` (nome/cognome/email), `limit` (max 200), `cursor`.

### GET /users/:id
Scheda singola con gli stessi campi.

### GET /time-entries
Ore confermate in un periodo, con: persona, progetto, attività prevista, cliente collegato (per i progetti interni), data, ora inizio/fine, ore, note.

Filtri: `from` e `to` (obbligatori, massimo 92 giorni per richiesta), `user_id`, `project_id`, `limit` (max 500), `cursor`.

Risposta con riepilogo: ore totali, ore per persona, ore per progetto.

### GET /users/:id/time-summary
Riepilogo rapido per una persona in un periodo: ore totali e ripartizione per progetto e per settimana.

## Cosa NON viene esposto
Nessun dato economico o contrattuale: né tariffa oraria, né tipo di contratto o ore contrattuali, né produttività target, né bio/competenze/interessi/lingue. Le API restano in sola lettura.

## Dettagli tecnici
- Estensione di `supabase/functions/public-api/index.ts`: nuove rotte `/users`, `/users/:id`, `/users/:id/time-summary`, `/time-entries`, con la stessa autenticazione a chiave, rate limit e logging in `api_request_logs` già in uso.
- Le persone arrivano da `profiles` (solo colonne non sensibili) più `user_roles` e `levels`; escluse per default le righe con `deleted_at` non nullo (`active=false` per includerle).
- Le ore arrivano da `activity_time_tracking` filtrando sulle registrazioni confermate, con join su `profiles`, `projects`, `budget_items` e `clients`.
- Ore calcolate da `actual_start_time`/`actual_end_time` con l'arrotondamento al minuto già usato altrove (`roundToMinute`), per coerenza con dashboard e timesheet.
- Paginazione cursor-based coerente con `/projects`; batching dei join per evitare il limite di 1.000 righe.
- Nessuna modifica al database e nessun nuovo permesso: gli scope delle chiavi restano invariati.
- Aggiornamento della documentazione in `src/components/PublicApiSection.tsx` con i nuovi endpoint, filtri e un esempio cURL.

## Verifica
- Typecheck e build.
- Chiamate di prova con una chiave reale su `/users` e `/time-entries` per una settimana nota, confrontando il totale ore con il timesheet di progetto.
