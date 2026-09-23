# Registro consegne come nel foglio "Gantt & Registro consegne"

Il foglio condiviso, nella scheda "Registro Consegne", ha queste colonne: **Assegnazione (Larin / Cliente / Designer), Attività, Data prevista, Consegna Larin, Conferma cliente, Stato, Impatto sul Gantt**. La tabella attuale in TimeTrap ha solo titolo, data prevista, data effettiva e note: va allineata, collegata alle attività a budget e collegata alla timeline.

## Risultato per l'utente

Nella scheda progetto (e nella retrospettiva) il registro consegne diventa una tabella con:

| Assegnazione | Consegna | Data prevista | Consegna Larin | Conferma cliente | Stato | Slittamento | Note |

- **"Genera da attività"**: un pulsante apre l'elenco delle attività previste del progetto; spunti quelle che sono consegne/milestone e vengono create le righe con il nome dell'attività già compilato (assegnazione impostabile prima di confermare).
- **Aggiunta manuale**: si possono comunque inserire consegne non collegate a nessuna attività (es. "Consegna materiale grafico" a carico del designer).
- Ogni riga collegata a un'attività mostra il collegamento, così si vede a quale attività a budget appartiene la consegna.
- **Stato**: Da fare, In corso, Completato, Bloccato, Annullato. Passa automaticamente a "Completato" quando inserisci la data di consegna Larin, e resta modificabile.
- **Scostamento** in giorni tra prevista ed effettiva, con badge "In tempo" / "+n g"; alimenta la puntualità (OTD) nei dati oggettivi della retrospettiva.

### Slittamento che aggiorna la timeline

- Nella riga indichi i **giorni di slittamento** (calcolati automaticamente dal ritardo, comunque modificabili a mano).
- Premendo **"Applica alla timeline"** l'attività collegata e tutte quelle che iniziano dopo di essa vengono spostate in avanti di quei giorni nel Gantt del progetto, con conferma prima di procedere e messaggio che indica quante attività sono state spostate.
- Se il ritardo viene poi corretto, lo slittamento già applicato non viene riapplicato due volte: la riga ricorda quanti giorni sono stati riportati sulla timeline.
- Le righe non collegate a un'attività non applicano nulla alla timeline (solo annotazione).

## Interventi

1. **Database** — estendere `project_deliverables` con: assegnazione, stato, data conferma cliente, giorni di slittamento, giorni già applicati alla timeline, ordinamento e collegamento opzionale all'attività a budget. Le consegne esistenti restano valide (nuovi campi vuoti). Nessun dato eliminato.

2. **Hook** — `useProjectRetrospective.ts` (`useProjectDeliverables`): nuovi campi in lettura/scrittura, ordinamento per data prevista, creazione multipla dalle attività selezionate e funzione che applica lo slittamento spostando `start_day_offset` delle attività interessate.

3. **Tabella** — `ProjectDeliverablesCard.tsx`: nuove colonne (assegnazione, stato, conferma cliente, slittamento con pulsante "Applica alla timeline"), stato automatico alla data di consegna, inserimento manuale e pulsante "Genera da attività". Su schermi stretti la tabella scorre in orizzontale.

4. **Dialog di generazione** — nuovo componente con l'elenco delle attività previste (nome, categoria, ore), spunte multiple, assegnazione e data prevista opzionale; crea le consegne in un colpo solo escludendo le attività già presenti nel registro.

5. **Timeline** — dopo l'applicazione dello slittamento, il Gantt del progetto si aggiorna subito (ricarico delle attività) così le nuove date sono visibili senza ricaricare la pagina.

6. **Retrospettiva** — OTD e verbale scaricabile usano lo stesso registro, mostrando anche stato e slittamenti applicati.

7. **Verifiche** — controllo TypeScript e build, prova di generazione da attività, aggiunta manuale, modifica date/stato, calcolo scostamento e spostamento corretto della timeline.

## Nota tecnica

Nuove colonne su `project_deliverables`: `owner_side text default 'larin'`, `status text default 'da_fare'`, `client_confirmed_date date`, `gantt_impact_days int`, `gantt_impact_applied_days int default 0`, `display_order int default 0`, `budget_item_id uuid references public.budget_items(id) on delete set null`. Lo slittamento agisce su `budget_items.start_day_offset` (la stessa colonna che il Gantt usa per posizionare le barre): incrementa l'attività collegata e tutte quelle con offset maggiore o uguale, applicando solo il delta non ancora riportato. Grant e policy esistenti restano valide; nessuna modifica alla RLS.
