# Bozza AI: solo sintesi precompilata, blocchi manuali, dicitura "nessun blocco"

## Obiettivo
1. La bozza AI precompila solo la **sintesi** (e lo stato di salute suggerito); i blocchi proposti **non** vengono inseriti automaticamente: restano elencati nel riquadro bozza e si aggiungono uno a uno con il tasto "+".
2. Se un aggiornamento viene pubblicato **senza blocchi**, l'aggiornamento lo dichiara esplicitamente: "Non sono stati segnalati blocchi".

## Modifiche

### 1. `ProgressUpdateDialog.tsx` — bozza senza blocchi precompilati
- `handleUseDraft` ("Applica bozza"): compila solo sintesi e stato di salute; non aggiunge più i `suggested_roadblocks` a `newRoadblocks`.
- Effetto `autoApplyDraft` (apertura da banner "Apri bozza" e dopo "Genera bozza AI"): stesso comportamento — solo sintesi + salute.
- I blocchi suggeriti restano visibili nel riquadro bozza con il tasto "+" per aggiungerli manualmente uno alla volta (comportamento già esistente, invariato).
- Il pulsante "Solo sintesi" resta com'è.

### 2. `ProjectProgressUpdates.tsx` — dicitura esplicita senza blocchi
- Nella scheda di ogni aggiornamento: se non ci sono blocchi segnalati in quell'aggiornamento (nessun roadblock creato con quell'update e nessun `roadblocks_text`), mostrare la riga in grigio: *"Non sono stati segnalati blocchi"*.
- Per stabilirlo serve un conteggio dei roadblock per `progress_update_id`: query su `project_roadblocks` raggruppata per update (o join), già disponibile lato client.
- Il filtro "Solo con blocchi" continua a funzionare: gli update con la dicitura "nessun blocco" restano esclusi.

### 3. Notifica Slack (`progressUpdates.ts`)
- Se `open_roadblocks` è vuoto, il messaggio Slack include la riga *"Nessun blocco segnalato ✅"* al posto della sezione roadblock (verificare/completare il ramo già previsto in `send-slack-notification`).

## Note tecniche
- Nessuna modifica al database: i dati necessari (`project_roadblocks.progress_update_id`, `roadblocks_text`) esistono già.
- La bozza AI continua a proporre salute e blocchi nel riquadro; cambia solo cosa viene copiato nei campi.
- Verifica finale: `bunx tsgo --noEmit` e `bun run build`.
