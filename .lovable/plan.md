# Task più ricche: rich-text, multi-assegnatari, date, stati e time tracking

Estensione delle task di progetto (tabella `project_tasks`, oggi con singolo `assignee_id`, `description` testuale, `due_date`, stati `todo|in_progress|done` e priorità `high|medium|low`) per coprire tutte le informazioni richieste.

## Cosa vedrà l'utente

**Titolo e descrizione rich-text**
- Editor con grassetto, corsivo, liste, titoli, link, tabelle, blocchi di codice e immagini (caricate in uno storage bucket dedicato, incolla e drag&drop).
- Le descrizioni testuali esistenti restano leggibili e vengono convertite al primo salvataggio.

**Assegnatari multipli**
- Selettore multi-persona con avatar; la task compare nelle viste personali (dashboard "Le mie task", sidebar calendario) di ogni assegnatario.
- Nessuna perdita dati: l'attuale assegnatario diventa il primo della lista.

**Date**
- Data di inizio + data di scadenza, con validazione (inizio ≤ scadenza).
- Calendario e Agenda task usano la scadenza come oggi; le task con data di inizio futura sono visivamente attenuate.

**Stati (set fisso ampliato)**
- Da fare → In corso → In revisione → Completato, con colori distinti, in tutti i filtri, raggruppamenti, board e drag&drop già esistenti.
- Solo "Completato" imposta `completed_at` e genera l'eventuale occorrenza ricorrente successiva.

**Priorità**
- Restano Alta / Normale / Bassa (l'attuale "Media" viene mostrata come "Normale") con indicatore colorato coerente in lista, calendario, agenda e sidebar.

**Time tracking**
- Campo "ore stimate" sulla task.
- Timer start/stop nella scheda task e nella sidebar calendario: una sola registrazione attiva per utente alla volta.
- Riepilogo: stimato vs registrato (timer + ore degli slot calendario collegati alla task), con barra di avanzamento e elenco delle registrazioni (modificabili/eliminabili dall'autore, dal project leader e dagli admin).

## Database (migrazione)

- `project_tasks`: aggiunta `start_date`, `estimated_hours`, `description_html` (contenuto rich-text) mantenendo `description` come testo semplice per ricerca ed export.
- Nuovo stato `in_review` ammesso su `status`.
- Nuova tabella `project_task_assignees` (task, utente) con vincolo di unicità, per gli assegnatari multipli; backfill dall'attuale `assignee_id`, che resta come assegnatario principale per compatibilità.
- Nuova tabella `project_task_time_entries` (task, utente, inizio, fine, durata calcolata, note) per il timer.
- Accesso: le nuove tabelle seguono le stesse regole di `project_tasks` tramite la funzione `can_access_project_tasks`, con grants espliciti per `authenticated` e `service_role` e RLS attiva; le registrazioni di tempo sono modificabili solo dall'autore o da chi gestisce il progetto.
- Bucket storage privato per le immagini delle descrizioni, leggibile da chi può accedere alla task.

## Implementazione tecnica

- Editor: TipTap (`@tiptap/react` + starter-kit, table, image, link, code-block) in `src/components/ui/rich-text-editor.tsx` con sanitizzazione dell'HTML in lettura e serializzazione del testo semplice per la ricerca.
- `src/lib/projectTaskSort.ts`: aggiornare tipi (`in_review`, `start_date`, `estimated_hours`, `assignee_ids`), `STATUS_RANK`, `STATUS_LABELS`, etichetta "Normale", filtri per assegnatario basati sull'array; aggiornare `projectTaskViewCache` con i nuovi campi nella versione.
- `src/hooks/useProjectTasks.ts`: select con join assegnatari, mutation che sincronizza `project_task_assignees`, nuove mutation timer (`startTimer`, `stopTimer`) e query registrazioni; invalidazioni esistenti (`project-tasks`, `my-tasks`, `calendar-plannable-tasks`).
- `src/hooks/useMyTasks.ts`: filtro via junction table invece di `assignee_id`.
- UI: `ProjectTaskFormSheet` (editor, multi-select, date inizio/scadenza, stima ore), `ProjectTasksPanel`/`Calendar`/`Agenda` per stato "In revisione" e avatar multipli, nuovo `TaskTimer.tsx` e `TaskTimeSummary.tsx`.
- Test: estendere `src/test/project-task-sort.test.ts` e `project-task-view-cache.test.ts` (nuovi stati, multi-assegnatario, ordinamento con `start_date`) e aggiungere test puri per il calcolo delle durate timer.

## Fuori scope

- Stati definibili dall'utente per progetto.
- Sottotask e dipendenze tra task.
- Commenti e allegati sulle task (oltre alle immagini in descrizione).
