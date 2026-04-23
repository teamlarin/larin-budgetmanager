

## Auto-link cartelle Drive ai clienti + merge duplicati

Due interventi distinti sulla sezione Clienti.

---

### Parte 1 — Auto-link cartelle Drive ai 428 clienti senza cartella

**Stato attuale**
- 479 clienti totali, 51 con `drive_folder_id`, **428 senza**.
- Esiste già la edge function `google-drive-folders` che usa l'OAuth personale dell'utente loggato (`user_google_tokens`) e supporta `search-folders` (ricerca per nome) e `get-folder-info`.
- Punto di partenza standard: drive condiviso `"01 | CLIENTI - Server Larin Group"` → cartella `"Clienti"` (già definito in `src/lib/driveDefaults.ts`).

**Cosa faccio**

1. **Nuova edge function `auto-link-client-drive-folders`** (richiede Google connesso dall'utente che la lancia, come per le altre integrazioni Drive).
   - Risolve il drive `"01 | CLIENTI - Server Larin Group"` e la cartella radice `"Clienti"`.
   - Pagina ricorsivamente le sotto-cartelle dirette di `Clienti` (le cartelle cliente).
   - Per ogni cliente senza `drive_folder_id`, calcola il match con un algoritmo di normalizzazione robusto:
     - lowercasing, rimozione accenti, collasso spazi/punteggiatura
     - rimozione suffissi societari (`srl`, `s.r.l.`, `spa`, `s.p.a.`, `sas`, `snc`, `srls`, `gmbh`, `ltd`, `& c.`, `unipersonale`, ecc.)
     - confronto: 1) match esatto normalizzato, 2) match per inclusione bidirezionale, 3) similarità Levenshtein/Jaccard ≥ 0.9
   - Restituisce un report con: cliente → cartella proposta + score, raggruppati in `auto` (alta confidenza), `ambiguous` (più match plausibili), `none` (nessun match).

2. **UI in `ClientManagement.tsx`** — nuovo pulsante "Collega cartelle Drive" in alto, accanto a Importa/Nuovo cliente.
   - Apre un dialog "Collegamento automatico cartelle Drive".
   - Stato 1: pulsante "Avvia scansione" → invoca la function, mostra progress.
   - Stato 2: tabella risultati con tre tab: **Match automatici** (preselezionati), **Da rivedere** (multipli match, da scegliere manualmente con dropdown), **Nessun match**.
   - Ogni riga è deselezionabile/modificabile prima della conferma.
   - Pulsante "Applica selezionati" → aggiorna in batch `drive_folder_id` + `drive_folder_name` sui clienti selezionati.
   - Toast finale con conteggio aggiornati / saltati.

3. **Visibile solo ad admin** (coerente con le altre operazioni di gestione massiva su clienti).

---

### Parte 2 — Rimozione duplicati clienti

**Duplicati rilevati** (14 coppie, 28 record): tutte varianti della stessa ragione sociale con/senza forma giuridica:

```
Azzurrodigitale ↔ Azzurrodigitale SRL
Compagnia del Legno ↔ Compagnia Del Legno S.r.l.
I.M.C. Interactive Marketing Company ↔ ...srl
Ihope S.r.l. ↔ ihope srl
Italtecnica ↔ Italtecnica S.r.l.
LC&Partners ... S.r.l. ↔ LC&PARTNERS ... SRL
LORAN S.R.L. ↔ Loran Srl
Mefop S.p.A. ↔ Mefop SpA
Rossi Oleodinamica ↔ Rossi Oleodinamica s.r.l.
Sades Impianti S.r.l. ↔ Sades Impianti srl
Sitar Italia ↔ Sitar Italia srl
Thélios ↔ Thélios S.p.A.
Zelger ↔ Zelger Gmbh
Zerynth S.r.l. ↔ Zerynth Spa
```

**Strategia: dialog interattivo di merge in `ClientManagement.tsx`**, NON cancellazione automatica.

1. Nuovo pulsante "Trova duplicati" (admin-only).
2. Dialog che lista le 14 coppie. Per ciascuna mostro:
   - I due record affiancati con tutti i campi rilevanti (nome, email, phone, account, livello strategico, drive folder, n. progetti, n. budget, n. contatti).
   - Radio per scegliere il **record da mantenere** (default: quello con più dati / con drive folder / con ragione sociale completa).
   - Checkbox per scegliere il **nome finale** (mantieni quello del record scelto, oppure quello dell'altro).
   - Pulsante "Salta" per ignorare la coppia.
3. Al "Conferma merge" per ogni coppia:
   - Riassegno tutti i riferimenti dal record da eliminare al record da tenere su queste tabelle: `budgets.client_id`, `projects.client_id`, `client_contact_clients.client_id`, `client_payment_splits.client_id` e elimino i `client_contacts` orfani duplicati.
   - Aggiorno il record da tenere con eventuali campi mancanti presi dal record da eliminare (email, phone, drive_folder, account_user_id, strategic_level, notes — solo se vuoti sul record tenuto).
   - Elimino il record duplicato.
4. Tutto in una **funzione SQL `merge_clients(keep_id uuid, drop_id uuid, final_name text)`** invocata via `supabase.rpc(...)` per atomicità (transazione singola).
5. Log in `user_action_logs` per ogni merge.

---

### Dettagli tecnici

- **Edge function**: `supabase/functions/auto-link-client-drive-folders/index.ts`. Usa `user_google_tokens` (stesso pattern di `google-drive-folders`). Niente connector gateway: usiamo già OAuth per-user su Drive.
- **DB**: nuova migration con funzione `public.merge_clients(uuid, uuid, text) RETURNS void` (security definer, restricted to admins via check `has_role(auth.uid(),'admin')`). Nessuna nuova tabella.
- **UI**: due nuovi componenti `AutoLinkDriveFoldersDialog.tsx` e `MergeClientsDialog.tsx` montati in `ClientManagement.tsx`.
- **RLS/permessi**: pulsanti gated by `permissions.canManageUsers` (admin).
- **Backup safety**: il merge non tocca tabelle senza prima riassegnarne i FK; se la riassegnazione fallisce la transazione fa rollback.

### Note operative

- Per la Parte 1 devi essere loggato con un account che ha **Google connesso e accesso al drive condiviso "01 | CLIENTI - Server Larin Group"**.
- Per la Parte 2 ti faccio rivedere a mano ogni coppia prima del merge: 14 coppie, ~5 minuti totali.
- Posso gestire i duplicati anche **automaticamente** (regola: tenere il record con `drive_folder_id` o quello con più progetti), ma sconsiglio: la revisione manuale evita di perdere note/email scritte solo su uno dei due.

