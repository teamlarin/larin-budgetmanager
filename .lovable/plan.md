

## Test mode per la generazione bozza Slack

Quando un admin clicca "Genera bozza ora" su un canale con poco traffico, la function risponde `skipped_no_messages` perché richiede almeno 3 messaggi "rilevanti" (≥5 parole, non-bot) negli ultimi 7 giorni. Per consentire il test end-to-end anche su canali tranquilli, aggiungo parametri opzionali e un comportamento più permissivo in modalità manuale admin.

### Comportamento

**Modalità cron (settimanale)**: nessuna modifica — soglia 3 messaggi, finestra 7 giorni.

**Modalità manuale admin (con `force: true`)**:
- Finestra estesa configurabile via `lookbackDays` (default 14 giorni in manuale, max 30)
- Soglia minima di messaggi ridotta a **1** (basta un messaggio rilevante per generare)
- Filtro parole ridotto a **3 parole** invece di 5 (manuale)
- Se ancora 0 messaggi rilevanti, la function genera comunque una bozza "vuota" segnalando esplicitamente nel testo AI che il canale è stato silente, così l'admin può comunque vedere il flusso completo (bozza → revisione → pubblicazione)

### UI

Nessuna modifica visibile aggiuntiva. Il pulsante "Genera bozza ora" continua a chiamare con `force: true`. In caso di canale silente, invece del toast "Pochi messaggi", l'utente vedrà la bozza apparire (eventualmente con testo che evidenzia la mancanza di attività).

### Aggiornamento toast UI

Il toast `skipped_no_messages` resta come fallback ma diventa improbabile. Aggiungo un toast informativo quando la bozza è generata da finestra estesa o canale silente: "Bozza generata (canale poco attivo)".

### File toccati

- `supabase/functions/generate-slack-progress-drafts/index.ts`
  - Body opzionale esteso: `{ projectId?, force?, lookbackDays?, minMessages? }`
  - In manuale: `lookbackDays` default 14, `minMessages` default 1, soglia parole ridotta
  - Se nessun messaggio rilevante e force=true: genera bozza "fallback" via AI con prompt dedicato
  - Aggiunta nello stats di un flag `extended_window: true` quando applicabile
- `src/components/ProgressUpdateDraftBanner.tsx`
  - Toast per il nuovo caso "bozza generata da canale silente"

### Dettagli tecnici

- `oldestTs` calcolato dinamicamente: `now - lookbackDays * 86400`
- `filterRelevantMessages` accetta param `minWords`
- Prompt AI fallback: "Il canale Slack è stato poco attivo questa settimana. Scrivi un breve update onesto che segnali che non ci sono aggiornamenti significativi da Slack e suggerisca al PM di integrare manualmente."
- Nessuna modifica a DB, RLS, schema o config.toml
- Cron job invariato (chiama senza body → comportamento originale)

