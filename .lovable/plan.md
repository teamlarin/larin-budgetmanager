# Offerta online: condizioni contrattuali, firma caricata e doppia accettazione

## Cosa manca oggi

Sulla pagina che vede il cliente:
- le condizioni generali non compaiono perché il testo non è mai stato inserito: il campo esiste ma è vuoto;
- la firma si può solo disegnare col dito o col mouse, non caricare come immagine;
- c'è una sola spunta di accettazione, sempre attiva.

## Cosa faremo

### 1. Condizioni generali inserite una volta e modificabili

- Inserisco nel sistema il testo delle condizioni generali del preventivo allegato (26 articoli, dall'accettazione al foro competente), suddiviso per articoli.
- In Impostazioni nasce una scheda "Condizioni offerta" dove puoi rileggere e aggiornare il testo: da lì in poi tutte le nuove offerte lo mostrano.
- Nella pagina cliente le condizioni diventano una sezione a sé, con gli articoli numerati e leggibili, e restano incluse nel PDF scaricabile e in quello firmato.
- Le condizioni specifiche di prodotto continuano a comparire sotto, come già oggi.

### 2. Firma: disegnata oppure caricata

- Due modi alternativi nella stessa area: "Disegna la firma" e "Carica un'immagine".
- Formati accettati: jpg, png, webp, heic; massimo 5 MB; anteprima con possibilità di rimuovere e ricaricare.
- L'immagine caricata finisce nel PDF firmato esattamente come la firma disegnata, alla stessa dimensione e posizione.

### 3. Due spunte separate

- Prima spunta: presa visione delle condizioni generali e specifiche.
- Seconda spunta: accettazione dell'offerta e del relativo importo.
- Il pulsante "Accetta e firma" si attiva solo con nome, firma (disegnata o caricata) ed entrambe le spunte.
- Le due conferme vengono registrate con data e ora insieme alla firma e riportate nel PDF firmato, come prova dell'accettazione.

### 4. Altre cose che mancano (le includo)

- Data e ora della firma visibili nella pagina e nel PDF, oggi non mostrate al cliente.
- Blocco dati del firmatario nel PDF firmato: nome, ruolo, email, indirizzo IP.
- Dati di pagamento (IBAN) nel documento, come nel preventivo attuale.
- Nota informativa privacy sotto le spunte, con il riferimento al trattamento dei dati del firmatario.

## Dettagli tecnici

- Testo condizioni: `app_settings.setting_key = 'offer_general_terms'`, popolato via `run_sql` come array di articoli (`{articles:[{number,title,text}]}`) più `text` per compatibilità con `build_offer_version_snapshot`; snapshot esteso a `terms.articles`.
- Nuovo componente `OfferTermsSettings` in `src/pages/Settings.tsx`, scrittura riservata ad admin (policy `app_settings` esistenti).
- `src/pages/PublicOffer.tsx`: sezione condizioni articolata, upload firma con validazione tipo/peso e conversione a PNG dataURL (stesso canale `signature_png` già gestito da `offer-public`), campo `signature_source` (`drawn` | `uploaded`), due stati checkbox inviati come `acknowledged_terms_at` / `accepted_offer_at`.
- `supabase/functions/offer-public/index.ts` + `pdf.ts`: validazione dei nuovi campi, condizioni generali stampate nel PDF, pagina finale con firma, data/ora, dati firmatario e le due conferme.
- Migrazione: colonne `signature_source`, `terms_acknowledged_at`, `offer_accepted_at` su `offer_signatures`, con aggiornamento del guard append-only.
- Nessuna modifica ai flussi di maturazione pagamenti o alla creazione progetto dall'offerta accettata.
