# Budget da HubSpot: non ricreare quelli esclusi

## Perché succede

Il foglio Google alimentato da HubSpot contiene ancora la riga "FasG&P - Nuovo sito web". La sincronizzazione gira alle 8:00, 12:00 e 18:00 e ricrea il budget ogni volta, perché confronta il foglio con i budget esistenti: se non lo trova, lo crea di nuovo.

## Cosa faccio

- Quando un budget nato dal foglio viene cancellato, TimeTrap lo registra in una lista di esclusioni e non lo ricrea più, anche se la riga resta nel foglio.
- La lista tiene traccia della trattativa (nome + cliente), di chi l'ha esclusa e quando.
- In Impostazioni compare un piccolo elenco "Trattative escluse dalla sincronizzazione", con la possibilità di riammettere una trattativa (al giro successivo il budget torna).
- Escludo subito "FasG&P - Nuovo sito web" così non si ripresenta.

## Dettagli tecnici

- Nuova tabella `public.hubspot_budget_exclusions` (`deal_name`, `client_name`, `excluded_by`, `created_at`), RLS: lettura per utenti approvati, scrittura solo admin/account; grant a `authenticated` e `service_role`.
- `supabase/functions/sync-budget-drafts/index.ts`: carica le esclusioni e salta le righe il cui `dealName` normalizzato (lowercase/trim) coincide; conteggio `budgets_excluded` nel risultato.
- Cancellazione budget (lista budget / azioni riga): se il budget corrisponde a una riga del foglio, inserisce l'esclusione insieme alla cancellazione, con conferma nel dialog ("non verrà più ricreato da HubSpot").
- Pannello di gestione in Impostazioni con eliminazione riga per riammettere la trattativa.
- Deploy della Edge Function `sync-budget-drafts`.
