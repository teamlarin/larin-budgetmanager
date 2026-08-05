# Sidebar calendario: nessuna attività assegnata

## Situazione

Nella sidebar del calendario (sia in vista Giornaliera sia in Planner, sul tuo calendario) la lista delle attività assegnate risulta vuota.

Verifiche già fatte sul database:
- Le attività assegnate esistono e sono numerose (centinaia di righe assegnate agli utenti, nessuna esclusa per categoria "import" o per flag prodotto).
- I permessi di lettura su attività, registrazioni tempo e completamenti sono corretti.
- Non risultano completamenti massivi che potrebbero "svuotare" la lista spostando tutto tra le completate.

Quindi i dati ci sono: la causa più probabile è che il caricamento delle attività della sidebar vada in errore lato app (la lista fallisce silenziosamente e mostra "Nessuna attività assegnata"). La causa esatta **non è ancora confermata**, quindi il primo passo del lavoro è verificarla.

## Piano

1. **Diagnosi (primo passo)**
   - Aprire il calendario nel browser autenticato e leggere console + richieste di rete per individuare quale chiamata del caricamento attività fallisce (attività assegnate, registrazioni tempo, o il ciclo di calcolo delle ore confermate).
   - Confermare la causa prima di modificare la logica.

2. **Fix della causa individuata**
   - Correggere la chiamata/logica che fallisce, senza cambiare le regole di visibilità attuali (escludere prodotti, categoria "import", progetti archiviati o completati).

3. **Rendere visibile l'errore invece di una lista vuota**
   - Se il caricamento fallisce, mostrare nella sidebar un messaggio di errore con pulsante "Riprova", distinto dal caso legittimo "Nessuna attività assegnata".
   - Aggiungere uno stato di caricamento per evitare che durante il fetch sembri vuota.

4. **Robustezza del caricamento**
   - Rendere il calcolo delle ore confermate resistente ai grandi volumi (batch e paginazione già usati altrove nel progetto), così un singolo batch non fa cadere l'intera lista.

5. **Verifica finale**
   - Ricontrollare la sidebar in vista Giornaliera e Planner, sul proprio calendario e su quello di un altro utente, verificando anche il filtro "Tutti i progetti" e la sezione "Attività completate".

## Note tecniche

- Componenti coinvolti: `src/pages/Calendar.tsx` (query `user-activities`, `user-completed-activities`) e `src/components/calendar/CalendarSidebar.tsx` (stati vuoto/errore/caricamento).
- Nessuna modifica al database prevista.
