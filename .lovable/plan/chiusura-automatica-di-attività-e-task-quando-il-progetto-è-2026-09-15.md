# Chiusura automatica di attività e task quando il progetto è "Completato"

Oggi, quando un progetto passa a **Completato**, vengono marcate come completate solo le attività previste (nel calendario delle persone assegnate) e solo se il cambio avviene dalla scheda progetto. Dalla lista progetti questo non accade, e le task restano sempre aperte.

## Cosa cambia

Quando un progetto passa a **Completato**, in automatico e da qualsiasi punto dell'app:

1. Tutte le **task** del progetto non ancora completate (Backlog, Da fare, In corso, Bloccata) passano a **Completata**, con data di completamento = momento della chiusura del progetto.
2. Tutte le **attività previste** del progetto vengono marcate come completate per le persone assegnate (come già avviene oggi dalla scheda progetto).
3. Nessuna notifica di massa: la chiusura automatica non genera decine di notifiche "Task completata" alle persone.

Se il progetto viene riaperto (torna ad Aperto / Da fatturare), le task restano completate: non c'è ripristino automatico.

## Dettagli tecnici

- Nuova funzione trigger `public.complete_open_items_on_project_completion()` su `projects`, `AFTER UPDATE`, condizione `NEW.project_status = 'completato' AND OLD.project_status IS DISTINCT FROM NEW.project_status`:
  - `UPDATE public.project_tasks SET status = 'done', completed_at = now() WHERE project_id = NEW.id AND status <> 'done'`
  - `INSERT INTO public.user_activity_completions (user_id, budget_item_id, completed_at) SELECT assignee_id, id, now() FROM public.budget_items WHERE project_id = NEW.id AND assignee_id IS NOT NULL ON CONFLICT (user_id, budget_item_id) DO NOTHING`
  - `SECURITY DEFINER`, `SET search_path = public`, nessun `EXECUTE` a `PUBLIC`/`anon`/`authenticated` (viene invocata solo dal trigger).
- Per evitare lo spam di notifiche: la funzione imposta `set_config('app.bulk_task_completion', 'on', true)` prima dell'UPDATE, e `notify_task_status_change` esce subito quando quel flag è attivo (`current_setting('app.bulk_task_completion', true) = 'on'`).
- Le automazioni esistenti sul completamento (webhook Make, notifica Slack, `notify_project_completed_webhook`) restano invariate.
- Il codice client in `src/pages/ProjectCanvas.tsx` che pre-completa le attività diventa ridondante: lo rimuovo per lasciare una sola fonte di verità (il trigger), mantenendo webhook e Slack.
- Nessuna modifica ai dati storici: i progetti già completati con task aperte non vengono toccati (posso farlo in un secondo passaggio se serve).
