# Connettore MCP: dati progetto più completi

Oggi il connettore restituisce pochi campi sui progetti (nome, stato, area, date, cliente) e le ore solo tramite strumenti separati. L'obiettivo è che Claude (o altri client MCP) possa capire un progetto in una sola chiamata: tipologia, date, budget, avanzamento, persone, task e registrazioni di tempo.

## Cosa cambia

### 1. Elenco progetti più informativo
`list_projects` restituirà anche: tipologia progetto, disciplina, avanzamento %, budget totale e ore previste, fatturabile sì/no, tipo di fatturazione, numero preventivo, nome cliente, referente cliente, project leader, margine previsto, data creazione e ultimo cambio stato.

Nuovi filtri: area, tipologia, cliente, intervallo di date (progetti attivi in un periodo), e ordinamento per data di fine.

### 2. Scheda progetto completa
`get_project` restituirà una scheda strutturata invece della riga grezza:
- anagrafica: nome, descrizione, obiettivi, tipologia, area, disciplina, stato, avanzamento
- date: inizio, fine, creazione, ultimo cambio stato
- economics: budget totale, ore previste, sconto, margine, costi aggiuntivi, fatturabile e tipo fatturazione
- cliente e referente, project leader, account, membri del team
- attività previste (voci di budget) con ore e categoria
- collegamenti: cartella Drive, canale Slack, numero preventivo/offerta
- ultimi aggiornamenti di avanzamento (i più recenti)

### 3. Registrazioni di tempo per progetto (nuovo strumento)
`list_project_time_entries`: dato un progetto, restituisce le registrazioni di tempo nel periodo richiesto, con persona, attività, cliente collegato (progetti interni), ore e note. Include un riepilogo: ore totali, ore per persona, ore per attività, ore per settimana. Rispetta gli stessi limiti di visibilità già usati da `list_time_entries` (admin tutto, team leader la propria area, gli altri solo le proprie ore).

### 4. Task di progetto (nuovo strumento)
`list_project_tasks`: task del progetto con titolo, stato, priorità, scadenza, assegnatari e attività collegata; filtri per stato, priorità e scadenza entro una data.

### 5. Istruzioni del connettore aggiornate
Il testo di istruzioni del server MCP spiegherà quando usare ogni strumento, così il client sceglie da sé la chiamata giusta.

## Dettagli tecnici

- Nuovi file: `src/lib/mcp/tools/project-time-entries.ts`, `src/lib/mcp/tools/project-tasks.ts`; registrazione in `src/lib/mcp/index.ts`.
- Estensione di `src/lib/mcp/tools/list-projects.ts` e `get-project.ts` (select ampliata + join su `clients`, `client_contacts`, `profiles`, `project_members`, `budget_items`, `project_progress_updates`).
- Le letture per progetto restano su client utente (RLS). Le registrazioni di tempo usano il percorso già collaudato: `resolveScope` + client service-role con filtro esplicito sugli utenti consentiti, come in `list-time-entries.ts`.
- Ore calcolate da `actual_start_time`/`actual_end_time` con la stessa funzione di arrotondamento al minuto già in uso, per coerenza con la dashboard.
- Paginazione a blocchi (100 id per `.in()`, pagine da 1000 righe) sui progetti con molte registrazioni.
- Nessuna modifica al database e nessuna nuova policy: si usano tabelle e permessi esistenti.
- Il manifest MCP (`.lovable/mcp/manifest.json`) viene rigenerato dalla build.

## Verifica
- Typecheck e build.
- Chiamata di prova ai nuovi strumenti su un progetto reale (es. un progetto "pack" e uno "recurring") confrontando ore totali con quelle mostrate nel timesheet di progetto.
