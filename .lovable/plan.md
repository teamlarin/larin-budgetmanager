# Rimuovere completamente la sezione "Decisioni"

## Obiettivo
Eliminare del tutto la funzionalità "Decisioni": tab nella scheda progetto, componente React e tabella del database (con i relativi dati).

## Modifiche previste

### Frontend
- `src/pages/ProjectCanvas.tsx`
  1. Rimuovere l'import di `ProjectDecisions`.
  2. Rimuovere il tab `<TabsTrigger value="decisions">Decisioni</TabsTrigger>`.
  3. Rimuovere il blocco `<TabsContent value="decisions">` con `<ProjectDecisions />`.
- Eliminare il file `src/components/ProjectDecisions.tsx`.

### Database (migrazione)
- `DROP TABLE public.project_decisions CASCADE` — rimuove tabella, indici, policy RLS e trigger collegati.
- `DROP FUNCTION public.set_project_decisions_updated_at()` — funzione trigger non più usata.

Attenzione: tutte le decisioni già registrate verranno eliminate in modo permanente e non recuperabile.

## Verifica
- La scheda progetto mostra solo le tab: Report & Analytics, Canvas e Attività, Timesheet, Costi esterni, Update.
- Nessun riferimento residuo a `project_decisions` nel codice applicativo.
