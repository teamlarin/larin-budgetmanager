# Cambio stato offerta: errore generico

## Cosa succede

Il menu a tendina dello stato (lista Offerte e dettaglio Offerta) propone quasi tutti gli stati possibili, ma il database accetta da un utente interno solo un sottoinsieme molto ristretto di transizioni. Verificato nella funzione `set_offer_version_status` e nei suoi controlli:

- **Vista, Accettata, Rifiutata**: possono essere scritte solo dal cliente tramite il link pubblico (attore `client`). Se le seleziona un utente interno il database solleva un errore.
- **Scaduta, Superata, Sostituita**: le scrive solo il sistema (automatismi). Selezionandole → errore.
- **Bozza**: consentita solo per respingere un'offerta che è "In approvazione", e richiede obbligatoriamente un motivo scritto (che oggi la UI non chiede) → errore.
- **Inviata**: consentita da Bozza (con eventuale passaggio automatico a "In approvazione" oltre le soglie) e da "In approvazione" ma solo per un admin diverso da chi ha composto l'offerta.
- Inoltre, uscendo da Bozza vengono validate le tranche di pagamento: se non quadrano con il totale offerto, la transizione viene bloccata.

In tutti questi casi la UI mostra sempre lo stesso messaggio generico "Si è verificato un errore durante l'aggiornamento dello stato", quindi non si capisce il motivo.

## Cosa fare

1. **Mostrare solo le transizioni realmente possibili**
   In `OfferStatusSelector` calcolare gli stati selezionabili in base allo stato corrente:
   - da **Bozza** → Inviata
   - da **In approvazione** → Inviata (approva) oppure Bozza (respingi), visibili solo agli admin
   - da **Inviata / Vista** → nessun cambio manuale dal menu; l'esito arriva dal link pubblico oppure dalla nuova azione "Registra esito manuale" (punto 2)
   - da **Accettata / Rifiutata / Scaduta / Superata / Sostituita** → nessun cambio manuale
   Quando non c'è nessuna transizione disponibile, mostrare lo stato come badge non modificabile.

2. **Registrazione manuale di accettazione o rifiuto (offerte firmate fuori dal link)**
   Nuova azione "Registra esito manuale" nel dettaglio offerta, per admin/account/finance, con una modale che chiede: esito (Accettata / Rifiutata), nome del firmatario, ruolo/email opzionali, data della firma, eventuale motivo del rifiuto e note. Facoltativo: allegare il PDF firmato.
   L'esito viene registrato come firma (con indicazione "registrata manualmente da <utente>") e la versione passa ad Accettata o Rifiutata, con l'evento tracciato in cronologia. Se la versione è ancora in Bozza, viene prima portata a Inviata (congelando il documento) senza passare dall'approvazione interna, perché il cliente ha già firmato.
   All'accettazione restano attive le automazioni esistenti (creazione progetto, copia attività, cartella Drive) e la maturazione delle tranche legate alla firma.

3. **Chiedere il motivo quando si respinge in approvazione**
   Selezionando "Bozza" da "In approvazione", aprire una piccola modale con il campo motivo (obbligatorio) e passarlo come `_note` alla funzione.

4. **Mostrare l'errore vero**
   Nel `catch`, usare il messaggio restituito dal database come descrizione del toast (con fallback al testo generico), così casi come "le tranche di pagamento non quadrano" o "chi ha composto l'offerta non può approvarla" diventano leggibili.

5. **Suggerimenti nel menu**
   Aggiungere una riga di aiuto nel dropdown quando gli stati sono bloccati (es. "Esito e visualizzazione li registra il cliente dal link pubblico; per un'offerta firmata a mano usa Registra esito manuale").

## Note tecniche

- Migrazione database:
  - `offer_signatures.public_link_id` diventa opzionale, con vincolo che imponga la presenza del link **oppure** dei dati di registrazione manuale (utente che registra); nuove colonne `recorded_by` (utente interno) e `signed_at`.
  - Nuova funzione `record_offer_manual_decision(_offer_version_id, _decision, _signer_name, _signer_role, _signer_email, _signed_at, _note, _reject_reason)`, `SECURITY DEFINER`, che verifica `is_approved_user` + `can_manage_offer_version`, congela il documento se serve, inserisce la firma manuale e chiama `set_offer_version_status`.
  - `assert_offer_transition_actor` viene rilassata solo per questo percorso tramite un flag di sessione impostato dalla funzione (`app.offer_manual_decision`), così le transizioni ad Accettata/Rifiutata restano vietate a qualsiasi altra scrittura diretta; la funzione passa da `IMMUTABLE` a `STABLE`.
  - `guard_offer_signatures_append_only` resta invariato: le firme non si modificano né cancellano.
- File toccati lato UI: `src/components/OfferStatusSelector.tsx` (stati ammessi, dialogo motivo, messaggio d'errore), nuovo `src/components/offers/RecordManualDecisionDialog.tsx`, `src/pages/OfferDetail.tsx` (pulsante azione). Il selettore ha bisogno del ruolo utente (prop opzionale dalle pagine).

