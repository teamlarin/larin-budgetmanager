# Fix: bozza AI che resta dopo aver pubblicato l'aggiornamento

## Causa (verificata)
Quando si pubblica un aggiornamento senza usare la bozza, l'app prova a segnarla come "superata"; quando si scarta, come "scartata" con un valore diverso da quello previsto. Il database accetta solo `pending`, `published`, `discarded`, quindi il salvataggio viene rifiutato in silenzio e la bozza resta "in attesa". Esempio: Mecomit - Restyling sito web, bozza del 24 set ancora `pending`.

## Modifiche
1. Database: estendere i valori ammessi dello stato bozza con `superseded` (e mantenere `discarded`).
2. `ProgressUpdateDialog.tsx`: "Scarta" usa `discarded` (non `dismissed`); in caso di errore dal database mostrare un avviso invece di ignorarlo; dopo l'aggiornamento invalidare anche la query del banner, così sparisce subito.
3. `publishProgressUpdate`: dopo ogni pubblicazione archiviare come `superseded` tutte le bozze ancora `pending` del progetto (copre anche pubblicazioni da altri punti dell'app).
4. Pulizia dati: segnare `superseded` le bozze `pending` di progetti che hanno già un aggiornamento pubblicato dopo la creazione della bozza (incluso Mecomit).

## Verifica
Pubblicare un aggiornamento su un progetto con bozza e controllare che il banner sparisca; build senza errori.
