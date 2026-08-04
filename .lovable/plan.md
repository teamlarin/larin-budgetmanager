# Rimuovere la sezione "Decisioni" dalla scheda progetto

## Obiettivo
Nascondere e rimuovere la tab "Decisioni" dalla pagina della scheda progetto (`ProjectCanvas`), lasciando intatto il componente `ProjectDecisions` e la tabella `project_decisions` per non perdere i dati storici.

## Modifiche previste

### Frontend
- File interessato: `src/pages/ProjectCanvas.tsx`
- Operazioni:
  1. Rimuovere l'import di `ProjectDecisions`.
  2. Rimuovere il tab trigger `<TabsTrigger value="decisions">Decisioni</TabsTrigger>`.
  3. Rimuovere il `<TabsContent value="decisions">` e il relativo `<ProjectDecisions ... />`.

### Non in scope (conservati)
- Il componente `src/components/ProjectDecisions.tsx` resta nel repository.
- La tabella `public.project_decisions` e le sue policy RLS restano invariate nel database.
- I dati storici delle decisioni non vengono eliminati.

## Verifica
- Aprire un progetto qualsiasi nella scheda progetto e confermare che il tab "Decisioni" non appaia più nella barra dei tab.
- Verificare che le tab rimanenti (Report, Canvas, Timesheet, Costi esterni, Update) continuino a funzionare normalmente.
