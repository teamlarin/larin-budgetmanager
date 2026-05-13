## Piano: auto-matching utenti TimeTrap ↔ dipendenti Jethr

### Obiettivo
Quando si apre "Mappa utenti", proporre automaticamente un abbinamento tra ogni profilo TimeTrap e un dipendente Jethr (estratto da `/employees/` o dal fallback su `/presence-absence-requests/`), così l'utente vede subito i match e può solo confermarli o correggerli.

### Logica di matching (client-side, in `JethrIntegration.tsx`)

Per ogni profilo TimeTrap calcolo uno score verso ogni dipendente Jethr non ancora usato e prendo il migliore se supera una soglia.

Segnali, in ordine di forza:
1. **Email identica** (case-insensitive, normalizzata) → match certo, score massimo.
2. **Local-part email identica** (parte prima della `@`) → match molto forte.
3. **Codice fiscale identico** (se presente su entrambi) → match certo.
4. **Nome + cognome identici** (case-insensitive, accenti rimossi, trim) → match forte.
5. **Cognome identico + iniziale nome** → match medio.
6. **Similarità stringa** (Dice/bigram) sul "Nome Cognome" combinato ≥ 0.85 → match medio-debole.

Vincoli:
- Un dipendente Jethr può essere proposto a un solo profilo. Si applica un assegnamento greedy ordinando i candidati per score decrescente.
- Email/codice fiscale superano sempre il nome.
- Il match proposto è solo un draft: nessun salvataggio automatico, solo precompilazione del Select.

### UI nel dialog

- Sopra la lista mostro un riepilogo: "X/Y utenti abbinati automaticamente".
- Pulsanti:
  - `Riapplica auto-match` — rilancia l'algoritmo (utile dopo cambio manuale o reload).
  - `Pulisci tutti` — rimette tutti i Select su "Non mappato".
- Per ogni riga: badge accanto al Select che indica come è avvenuto il match: `email`, `codice fiscale`, `nome`, `simile (0.92)`. Se non c'è match, badge grigio "manuale".
- Il Select resta modificabile per override manuale. Il flag/badge di provenienza si aggiorna a "manuale" se l'utente cambia.
- Salvataggio invariato: scrive `profiles.jethr_employee_id` solo per i record realmente cambiati rispetto al DB.

### Dettagli tecnici

- Helper `normalize(s)`: lowercase + `normalize('NFD')` + replace diacritics + trim + collapse whitespace.
- Helper `diceCoefficient(a, b)` su bigrammi.
- Auto-match eseguito:
  - alla prima `loadEmployees()` quando arrivano dipendenti,
  - cliccando "Riapplica auto-match",
  - ma solo per profili senza `jethr_employee_id` già salvato (i mapping esistenti non vengono sovrascritti).
- Stato: `matchInfo: Record<profileId, { reason: string; score?: number }>`.
- Nessun cambiamento all'edge function: i path candidati restano visibili come oggi quando `employees.length === 0`.

### Validazione

- Apro il dialog: verifico che, con la lista dipendenti attuale, i profili con email/nome corrispondenti vengano pre-mappati e contrassegnati con la motivazione corretta.
- Cambio manualmente un Select: il badge passa a "manuale" e il salvataggio scrive solo quel record.
- Click su "Pulisci tutti" → tutti i Select tornano a "Non mappato"; "Riapplica auto-match" li ripopola.