# Nuova scheda "Consegne / Milestone" nel progetto

## Obiettivo
Spostare la sezione Consegne / Milestone (oggi in fondo alla scheda "Canvas e Attività") in una propria scheda, posizionata subito dopo la scheda "Task".

## Modifiche — `src/pages/ProjectCanvas.tsx`
1. Aggiungere un nuovo tab trigger dopo "Task": valore `deliveries`, etichetta "Consegne / Milestone".
2. Creare il relativo `TabsContent value="deliveries"` contenente `<ProjectDeliverablesCard>` con le stesse prop attuali (`projectId`, `canManage` con i ruoli admin / team leader / project leader / account, sempre nascosto agli esterni).
3. Rimuovere `ProjectDeliverablesCard` dal `TabsContent` "canvas", che resta con Manager attività e Gantt.

## Note
- Nessun cambiamento a dati, permessi o componenti: solo riorganizzazione dell'interfaccia.
- Le logiche esistenti (generazione dalle attività, slittamento timeline, stato automatico) restano invariate.
