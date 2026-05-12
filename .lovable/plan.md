## Diagnosi

Incrociando log Edge Function + DB + replay UI:

1. **`jethr-list-employees` funziona**: il dialog mostra 31 utenti "non mappati" → quindi `employees.length > 0` e il blocco debug (visibile solo quando = 0) non appare. Il fix precedente alla paginazione è OK.
2. **`jethr-sync` ora pagina correttamente**: gli ultimi log mostrano `absences: total=353, approved=339` e `pending: total=353, pending=2` (timestamp combacia con "12 mag 2026 20:46:50" mostrato in UI). Quindi l'errore _"Request Line is too large (4474 > 4094)"_ visibile nelle card è **un valore stale** salvato in `last_sync_error` da un run precedente al fix.
3. **Tabella `jethr_absences` vuota (0 righe)**: nonostante 339 approvate scaricate, nulla è stato persistito. Causa: la mappa `jethrToUser` è costruita da `profiles.jethr_employee_id` ma in DB **nessun profilo è ancora mappato** (i 31 utenti del dialog sono tutti "non mappati"). Quindi il loop fa `if (!mapped) continue` per ogni assenza → `Assenze: 0` e `Pending: 0`.

Il sync, di fatto, sta funzionando: non ha nulla da scrivere finché non mappi gli utenti.

## Piano

### 1. Pulire l'errore stale (UI ingannevole)
In `supabase/functions/jethr-sync/index.ts`, all'inizio del run azzerare `last_sync_error` / `last_sync_summary` prima di iniziare, e a fine run scriverlo solo se la sync ha effettivamente fallito. Oggi il vecchio errore 400 resta visibile anche se l'ultimo run è andato bene.

### 2. Diagnostica chiara nella card Jethr
In `src/components/JethrIntegration.tsx`, quando `summary.unmatched_users` contiene la voce sentinel `"Nessun utente con jethr_employee_id mappato"` (già emessa dal sync), mostrare un banner azzurro tipo:
> "Nessun utente TimeTrap è mappato a un dipendente Jethr → la sync non può scrivere assenze/pending. Apri «Mappa utenti» per associarli."
con CTA che apre direttamente il dialog di mapping. Sostituisce il falso-allarme rosso "Jethr 400".

### 3. Mappare effettivamente gli utenti (azione utente)
Dopo i fix sopra, l'utente apre **Mappa utenti**, associa i 31 profili ai corrispondenti `jethr_employee_id` e salva. Al primo `jethr-manual-sync` successivo le tabelle `jethr_absences` / `jethr_pending_requests` si popolano e le card mostrano numeri reali.

### 4. (Opzionale) Robustezza employee id matching
Per sicurezza, in `jethr-sync` estendere il fallback dell'`empId` su una richiesta assenza con tutte le varianti già gestite in `normalizeEmployee` (`a.employee?.uuid`, `a.employee?.code`, `a.employee?.pk`, ecc.) — così anche se Jethr usa una chiave diversa per "employee" nelle absences vs employees, il match continua a funzionare.

## File toccati

- `supabase/functions/jethr-sync/index.ts` — reset/scrittura condizionale di `last_sync_error`; estensione dei fallback `empId` (sezioni Assenze e Pending).
- `src/components/JethrIntegration.tsx` — banner "Nessun utente mappato" + CTA al dialog di mapping; rimozione visualizzazione errore stale quando l'ultima sync è OK.

## Cosa NON tocco

- Non altero la logica di paginazione di `_shared/jethr.ts` (già corretta nel run precedente).
- Non modifico la edge function `jethr-list-employees`: i dipendenti arrivano correttamente.
