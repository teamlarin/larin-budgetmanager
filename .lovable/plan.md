# Escludi progetti con stato "completato" dalla selezione progetto nel calendario

## Problema
Nel calendario, la selezione progetti mostra ancora i progetti il cui `project_status` è `completato`. Questo accade nel dialogo di dettaglio/duplicazione attività e nella selezione usata per l'integrazione Google Calendar, dove la query `accessibleProjects` filtra solo per `status = 'approvato'` e non per `project_status`.

Il dialogo "Nuova attività manuale" (`CreateManualActivityDialog`) filtra già correttamente per `project_status = 'aperto'`, quindi lì non servono modifiche.

## Modifica proposta

### File: `src/pages/Calendar.tsx`
Aggiornare la query `accessibleProjects` per escludere i progetti con `project_status = 'completato'` in entrambe le sotto-query (leader e member).

````text
Leader query:
  .from('projects')
  .select('id, name')
  .eq('status', 'approvato')
  .neq('project_status', 'completato')
  .or(`project_leader_id.eq.${currentUser.id},account_user_id.eq.${currentUser.id}`)

Member query:
  .from('projects')
  .select('id, name, project_members!inner(user_id)')
  .eq('status', 'approvato')
  .neq('project_status', 'completato')
  .eq('project_members.user_id', currentUser.id)
````

Inoltre, durante l'elaborazione dei risultati della query member, ignorare eventuali progetti che dovessero comunque risultare con `project_status = 'completato'` come ulteriore sicurezza client-side.

## Verifica
- Costruire il progetto per verificare l'assenza di errori TypeScript.
- Usare Playwright per aprire il calendario, aprire il dialogo di dettaglio/duplicazione di un'attività e confermare che i progetti con `project_status = 'completato'` non siano presenti nella select "Progetto".

## Nota
Non si modificano altri flussi di selezione progetto (ad esempio il dialogo di creazione manuale, che già filtra per `project_status = 'aperto'`) né le tabelle/database.