## Problema

Quando un utente (es. admin) visualizza il calendario di un altro utente, gli eventi Google Calendar mostrati sono i **propri**, non quelli dell'utente selezionato. Questo perché la edge function `google-calendar-events` carica i token Google sempre da `user.id` ricavato dal JWT del chiamante.

## Soluzione

Permettere a chi può già visualizzare il calendario di un altro utente (`selectedUserId`) di vedere anche gli eventi Google di quell'utente, con titolo e orari completi.

### 1. Edge function `google-calendar-events`

- Accettare un nuovo query param opzionale `targetUserId`.
- Se presente e diverso dal chiamante:
  - Verificare che il chiamante abbia un ruolo abilitato a vedere il calendario altrui (admin / team_leader / coordinator — gli stessi ruoli che oggi vedono il selettore utente nel calendario).
  - Caricare i token da `user_google_tokens` usando `targetUserId` invece di `user.id`.
  - Aggiornare anche la riga `user_google_tokens` del target in caso di refresh del token.
- Se non passato o uguale al chiamante: comportamento attuale invariato.
- Se l'utente target non ha collegato Google: ritornare `{ connected: false, events: [] }` (come ora) senza errori.

### 2. Pagina `src/pages/Calendar.tsx`

- Nella query `google-calendar-events`:
  - Aggiungere `viewingUserId` alla `queryKey`.
  - Quando `viewingUserId !== currentUser.id`, passare `&targetUserId=<viewingUserId>` alla URL della edge function.
  - Saltare il blocco di sync `activity_time_tracking` (riga 606-627) quando si guarda un altro utente, per evitare scritture indesiderate sul proprio account; oppure eseguirlo usando `viewingUserId` come `user_id`. Scelta consigliata: eseguirlo usando `viewingUserId` così anche il "rinomina sincronizzato" funziona per il target.
- Verificare che `isGoogleConnected` non blocchi il caricamento quando si guarda un altro utente: il flag oggi rappresenta la connessione del **chiamante**. Va sostituito con un controllo che abiliti la query sempre se viene visualizzato un altro utente (la edge function risponderà comunque `connected:false` se il target non è collegato).

### 3. UI

- Se il target non ha Google collegato, mostrare un piccolo badge informativo nell'header del calendario ("Google Calendar non collegato per questo utente") al posto degli eventi — riusando lo stato `connected` ritornato dall'API.

## Note tecniche

- File coinvolti: `supabase/functions/google-calendar-events/index.ts`, `src/pages/Calendar.tsx`.
- Nessuna modifica DB / RLS: l'autorizzazione è fatta nella edge function via `has_role`.
- Nessun rischio di esposizione: la edge function valida il ruolo del chiamante prima di leggere i token altrui; i token Google non vengono mai restituiti al client, solo gli eventi.
