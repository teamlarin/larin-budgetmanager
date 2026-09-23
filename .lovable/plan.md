# Registro consegne come nel foglio "Gantt & Registro consegne"

Il foglio condiviso ha, nella scheda "Registro Consegne", queste colonne: **Fase, Assegnazione (Larin / Cliente / Designer), Attività, Data (prevista), Consegna Larin, Conferma cliente, Stato, Impatto sul Gantt**. La tabella attuale in TimeTrap ha solo titolo, data prevista, data effettiva e note: va allineata e collegata alle attività a budget.

## Risultato per l'utente

Nella scheda progetto (e nella retrospettiva) il registro consegne diventa una tabella con:

| Fase | Assegnazione | Consegna | Data prevista | Consegna Larin | Conferma cliente | Stato | Impatto | Note |

- **"Genera da attività"**: un pulsante apre l'elenco delle attività previste del progetto; spunti quelle che sono consegne/milestone e vengono create le righe con il nome dell'attività già compilato (fase e assegnazione impostabili prima di confermare).
- **Aggiunta manuale**: si possono comunque inserire consegne non collegate a nessuna attività (es. "Consegna materiale grafico" a carico del designer).
- Ogni riga collegata a un'attività mostra il collegamento, così si vede subito a quale attività a budget appartiene la consegna.
- **Stato**: Da fare, In corso, Completato, Bloccato, Annullato. Si imposta automaticamente a "Completato" quando inserisci la data di consegna Larin, e resta modificabile.
- **Scostamento** calcolato come oggi (giorni tra prevista ed effettiva), con badge "In tempo" / "+n g"; alimenta la puntualità (OTD) nei dati oggettivi della retrospettiva.
- **Impatto sul Gantt**: campo testo libero per annotare gli slittamenti (es. "7 giorni di slittamento").
- Le righe si ordinano per fase e data prevista.

## Interventi

1. **Database** — estendere `project_deliverables` con: fase, assegnazione, stato, data conferma cliente, impatto sul Gantt, ordinamento e collegamento opzionale all'attività a budget. Le consegne già inserite restano valide (nuovi campi vuoti). Nessun dato eliminato.

2. **Hook** — `useProjectRetrospective.ts` (`useProjectDeliverables`): includere i nuovi campi in lettura/scrittura, ordinamento per fase e data, e una funzione per creare più consegne in blocco dalle attività selezionate.

3. **Tabella** — `ProjectDeliverablesCard.tsx`: nuove colonne (fase, assegnazione, stato, conferma cliente, impatto), automatismo stato "Completato" alla data di consegna, riga di inserimento manuale e pulsante "Genera da attività". Su schermi stretti la tabella scorre in orizzontale.

4. **Dialog di generazione** — nuovo componente con l'elenco delle attività previste del progetto (nome + categoria + ore), spunte multiple, campi fase/assegnazione e data prevista opzionale, che crea le consegne in un colpo solo escludendo le attività già presenti nel registro.

5. **Retrospettiva** — l'OTD e il verbale scaricabile usano lo stesso registro, mostrando anche fase e stato.

6. **Verifiche** — controllo TypeScript e build, prova di generazione da attività, aggiunta manuale, modifica date/stato e calcolo scostamento.

## Nota tecnica

Nuove colonne su `project_deliverables`: `phase text`, `owner_side text` (default `larin`), `status text` (default `da_fare`), `client_confirmed_date date`, `gantt_impact text`, `display_order int default 0`, `budget_item_id uuid references public.budget_items(id) on delete set null`. Grant e policy esistenti restano valide; nessuna modifica alla RLS. Il Gantt del foglio non viene replicato: il progetto ha già `ActivityGanttChart`.
