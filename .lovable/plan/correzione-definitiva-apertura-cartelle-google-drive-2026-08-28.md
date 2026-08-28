# Correzione definitiva apertura cartelle Google Drive

## Diagnosi confermata
- Il pulsante della scheda progetto genera già un link HTML nativo con `target="_blank"` e un URL Drive corretto.
- Il problema si presenta anche dal sito pubblicato.
- Lo stesso URL, incollato manualmente in una nuova scheda, apre correttamente la cartella: ID e permessi Drive sono quindi validi.
- Il blocco dipende dal contesto con cui la navigazione esterna viene avviata, non dalla cartella.

## Intervento
- Aggiungere una piccola pagina/rotta interna dedicata all’apertura di Drive.
- Far puntare i pulsanti cartella a questa rotta interna in una nuova scheda, anziché direttamente a `drive.google.com`.
- Nella nuova scheda, validare l’ID della cartella e usare `location.replace()` per navigare verso `https://drive.google.com/drive/folders/{id}` come documento top-level.
- Applicare lo stesso flusso sia alla cartella progetto sia alla cartella cliente, mantenendo nome, icone e comportamento attuali.
- Limitare la rotta ai soli ID Drive validi, senza accettare URL arbitrari, per evitare un open redirect.

## Verifica
- Controllare che il click apra prima una vera nuova scheda sul dominio TimeTrap e che questa raggiunga poi Drive.
- Verificare il comportamento dalla preview e dal sito pubblicato.
- Verificare build, typecheck e assenza di errori runtime.
