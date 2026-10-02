# Ore da vocale direttamente in TimeTrap

Dal documento "Time tracking Larin": oggi un vocale a Claude crea una riga in Notion. L'obiettivo è che lo stesso vocale crei direttamente le ore nel timesheet di TimeTrap.

## Mappatura dei campi

| Campo Notion | Campo TimeTrap | Esito |
| --- | --- | --- |
| Quando (data + fascia) | Giorno, ora inizio, ora fine | Corrisponde |
| Ore | Calcolate da inizio/fine | Corrisponde (non serve dirle) |
| Attività (titolo breve) | Inizio delle note | Corrisponde |
| Note | Note dello slot | Corrisponde |
| Cliente | Cliente, poi **progetto** | Manca un dato: TimeTrap registra le ore su un progetto, e un cliente può averne più di uno attivo |
| Sottocategoria | **Attività a budget** del progetto | Da mappare: TimeTrap usa le attività del budget (es. "Grafiche social"), non un elenco fisso |
| "Interno" | Un progetto interno (es. Larin - Operations 2026, Management & pianificazione 2026) | Da mappare: va scelto quale progetto interno |
| Modalità (Riunione/Lavoro) | Nessun campo | Manca in TimeTrap |
| Pianificazione (Previsto/Emergenza/Opportunità) | Nessun campo | Manca in TimeTrap |
| Settimana ISO | Calcolata dalla data | Non serve |

**In sintesi**, i dati bastano se:
1. L'AI deduce il **progetto** dal cliente. Se il cliente ha più progetti attivi, si sceglie in base al contenuto del racconto, oppure lo si dice nel vocale ("progetto Personal Branding LinkedIn").
2. La **sottocategoria** diventa un suggerimento per scegliere l'attività a budget più vicina.
3. Si aggiungono due nuovi campi allo slot: **Modalità** e **Pianificazione**. Così l'analisi su emergenze e richieste improvvise resta possibile in TimeTrap.

## Cosa costruire
1. **Pulsante microfono "Registra ore a voce"** nel Calendario/Timesheet (da desktop e smartphone).
2. Il vocale viene trascritto e l'AI estrae uno o più slot: giorno, inizio, fine, progetto, attività, modalità, pianificazione, titolo e note. Si possono raccontare più attività nello stesso vocale.
3. **Schermata di revisione**: ogni slot proposto mostra i campi già compilati e modificabili. L'ora di fine viene segnalata se si sovrappone a slot esistenti. Si salva con "Conferma".
4. Gli slot vengono creati come **ore confermate** dell'utente (stesso comportamento del timesheet manuale). L'avanzamento e i margini si aggiornano come sempre.
5. **Campi Modalità e Pianificazione** disponibili anche nella finestra slot manuale (facoltativi) e come filtri e colonne nell'export del timesheet.
6. In alternativa al microfono si può **incollare il testo** (utile per chi già detta a Claude o usa Notion).

## Dettagli tecnici
- Migrazione: `activity_time_tracking.work_mode` (text: `riunione`/`lavoro`, nullable) e `planning_type` (text: `previsto`/`emergenza_cliente`/`opportunita`, nullable), validati con un trigger.
- Registrazione audio nel browser (MediaRecorder) → nuova edge function `voice-timesheet`: trascrizione con `google/gemini-3.5-transcribe`, estrazione strutturata con `openai/gpt-6-astra` (schema JSON strict). Il contesto passato all'AI contiene: data odierna (Europe/Rome), progetti accessibili all'utente con cliente, attività a budget non prodotto, sottocategorie del documento.
- Gli ID di progetto e attività restituiti vengono validati lato server contro i progetti dell'utente. L'insert avviene lato client dopo la conferma, con le stesse regole e RLS del timesheet attuale. Formato data `yyyy-MM-dd` (date-fns), orari `HH:mm`.
- Gestione errori AI: 402 per crediti esauriti, 429 per troppe richieste, messaggio chiaro nella revisione.

## Da confermare
- Quale progetto interno usare per "Interno" in base alla sottocategoria (es. Gestione team / Meeting interni → Management & pianificazione 2026; Pre-sales → Sales & Accounting 2026).
- Se i campi Modalità e Pianificazione vanno resi obbligatori o lasciati facoltativi.
