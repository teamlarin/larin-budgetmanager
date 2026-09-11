# Messaggio predefinito nell'invio dell'offerta al cliente

Oggi il campo "Messaggio (opzionale)" nella card "Invio al cliente" parte vuoto: chi invia deve scrivere ogni volta il testo di accompagnamento.

## Cosa cambia

- Il campo messaggio si apre già compilato con un testo predefinito, pensato per un'offerta commerciale.
- Il testo resta completamente modificabile prima dell'invio.
- Compare un pulsante "Ripristina testo predefinito" quando il testo è stato modificato, per tornare alla versione standard.
- L'etichetta diventa "Messaggio" (non più "opzionale"), e svuotando il campo l'email viene inviata senza paragrafo aggiuntivo, come oggi.

## Testo predefinito proposto

> Gentile [nome cliente],
>
> in allegato trova l'offerta richiesta, che può consultare e accettare direttamente online tramite il pulsante qui sotto.
>
> Resto a disposizione per qualsiasi chiarimento o per valutare insieme eventuali modifiche.

Il nome del cliente viene inserito automaticamente quando disponibile; il saluto e la firma finale restano quelli già presenti nell'email.

## Dettagli tecnici

- `src/components/offers/OfferPublicLinkPanel.tsx`: nuova funzione `buildDefaultSendMessage(clientName)`; `sendMessage` inizializzato con quel valore e riallineato quando cambia il cliente, solo se l'utente non ha ancora modificato il testo (flag `messageEdited`). Pulsante ghost per il ripristino.
- Serve il nome del cliente nel pannello: si aggiunge la prop `clientName` accanto a `clientEmail`, passata da `src/pages/OfferDetail.tsx` (il dato è già caricato per l'intestazione dell'offerta).
- Nessuna modifica alla Edge Function `offer-send-to-client`: continua a ricevere `message` e a ometterlo se vuoto.
