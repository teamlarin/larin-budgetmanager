# Sidebar calendario: mostrare le attività con registrazioni tempo

## Causa confermata

Le attività di "Albergo Benito - Sito web" hanno come assegnatario un **livello** (Project Leader, Mid level, Junior) e non una persona: sono ID della tabella livelli, non utenti reali. La sidebar carica le attività con `assignee_id = utente corrente`, quindi non ne trova nessuna.

Sulle tue registrazioni tempo l'attività "Project management" esiste (03 voci: 23/06, 05/08, 06/08). Il ripiego attuale della sidebar la includerebbe solo se: la registrazione non arriva da Google Calendar **e** la data è negli ultimi 30 giorni. Due delle tre voci hanno `google_event_id`, quindi la visibilità è fragile e sparirà a metà settembre.

## Cosa cambia

Regola richiesta, valida per tutti i progetti: **se ho registrazioni tempo su un'attività, quell'attività compare nella sidebar**, anche se l'assegnatario non sono io.

1. Nel caricamento attività del calendario, includere ogni attività per cui l'utente visualizzato ha almeno una registrazione tempo:
   - rimuovere il filtro "solo registrazioni non provenienti da Google Calendar";
   - rimuovere la finestra dei 30 giorni per queste attività (una registrazione anche vecchia basta a mostrarla).
2. Mantenere invariate le esclusioni legittime: prodotti, categoria "import", progetti archiviati o completati, attività già segnate come completate (che restano nella sezione "Attività completate").
3. Le ore pianificate/confermate mostrate su queste attività restano calcolate come oggi.
4. Effetto collaterale voluto: il filtro "Tutti i progetti" della sidebar mostrerà anche i progetti raggiunti solo dalle registrazioni tempo (es. Albergo Benito).

## Verifica

- Aprire il calendario (vista Giornaliera e Planner) con l'utente Alessandro e confermare la presenza di "Albergo Benito - Sito web - Project management" nella sidebar e nel filtro progetti.
- Controllare che non compaiano attività di progetti completati/archiviati e che la lista di un altro utente resti coerente.

## Note tecniche

- File: `src/pages/Calendar.tsx`, query `user-activities` (blocco di merge da `activity_time_tracking`, righe ~470-497): eliminare le condizioni `activitiesWithRealSchedules` e `scheduledDate < recentCutoff`.
- Nessuna modifica al database e nessuna modifica alle regole di accesso (RLS): la sidebar continua a leggere solo le registrazioni dell'utente visualizzato.
- Le assegnazioni errate a livelli anziché a persone (circa 688 voci su tutto il database) restano un tema di qualità dati separato, non affrontato in questo intervento.
