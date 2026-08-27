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
   - da **Inviata / Vista** → nessun cambio manuale (l'esito lo dà il cliente dal link pubblico)
   - da **Accettata / Rifiutata / Scaduta / Superata / Sostituita** → nessun cambio manuale
   Quando non c'è nessuna transizione disponibile, mostrare lo stato come badge non modificabile.

2. **Chiedere il motivo quando si respinge**
   Selezionando "Bozza" da "In approvazione", aprire una piccola modale con il campo motivo (obbligatorio) e passarlo come `_note` alla funzione.

3. **Mostrare l'errore vero**
   Nel `catch`, usare il messaggio restituito dal database come descrizione del toast (con fallback al testo generico), così casi come "le tranche di pagamento non quadrano" o "chi ha composto l'offerta non può approvarla" diventano leggibili.

4. **Suggerimenti nel menu**
   Aggiungere una riga di aiuto nel dropdown quando gli stati sono bloccati (es. "Esito e visualizzazione li registra il cliente dal link pubblico"), così è chiaro perché non si possono scegliere.

## Note tecniche

- Nessuna modifica al database: le regole lato server restano quelle attuali, la UI si allinea.
- File toccati: `src/components/OfferStatusSelector.tsx` (logica stati ammessi, dialogo motivo, messaggio d'errore). `src/pages/Offers.tsx` e `src/pages/OfferDetail.tsx` restano invariati; serve solo che il selettore sappia se l'utente è admin (lettura ruolo nel componente o prop opzionale passata dalle pagine).
