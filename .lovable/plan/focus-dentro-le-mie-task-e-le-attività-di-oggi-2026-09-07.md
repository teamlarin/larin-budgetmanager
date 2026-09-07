# Focus: dentro "Le mie task" e le attività di oggi

Nella tab "La mia settimana" la sezione Focus diventa il punto unico operativo: oltre alla lista progetti+task urgenti, mostra le attività pianificate di oggi e l'elenco completo "Le mie task". Oggi entrambe sono nascoste dentro l'accordion "Andamento" (`MemberDashboard`).

## Cosa cambia per l'utente

1. **Attività di oggi** (striscia compatta in cima alla sezione Focus, sotto "Da recuperare"): le attività pianificate per oggi con orario, progetto e stato conferma; se ce n'è una non confermata, bottone rapido che porta al calendario. Se non c'è nulla in giornata, la striscia non appare.
2. **Le mie task**: il widget esistente (raggruppamento per scadenza, checkbox di completamento, contatori, "Mostra tutte") viene spostato in fondo alla sezione Focus, con il suo titolo.
3. **Andamento**: l'accordion non contiene più "Le mie task" né le card "Attività di oggi" / "Prossime attività" (già visibili sopra); restano grafici, ore e progetti. Il filtro area della sezione Focus continua a valere solo per la lista Focus, non per task e attività personali.

## Dettagli tecnici

- `src/components/dashboards/TabbedDashboard.tsx`: passare a `WeeklyFocusView` anche `todayActivities` (già presenti in `memberData`).
- `src/components/dashboards/WeeklyFocusView.tsx`:
  - nuova prop opzionale `todayActivities?: Activity[]` (tipo già usato da `MemberDashboard`);
  - striscia compatta "Oggi" sotto il blocco "Da recuperare": righe con orario (`scheduled_start_time`/`end_time`), nome attività/progetto, badge confermata/da confermare e bottone "Conferma" → `/calendar?date=...`;
  - importare e renderizzare `MyTasksWidget` in fondo alla sezione Focus (dopo la lista `rows`, prima del link "Tutti i progetti"), con `userId` già in props.
- `src/components/dashboards/MemberDashboard.tsx`: rimuovere `<MyTasksWidget userId={userId} />` (linea ~278) e le due card "Attività di oggi" (linee ~494-526) e "Prossime attività" (linee ~528+), che diventano ridondanti. Verificare che `nextActivity` e i conteggi in testata di MemberDashboard non dipendano dalle card rimosse (in tal caso mantenere la logica, togliere solo la UI).
- Nessuna nuova query: `todayActivities` arriva dalle fetch esistenti di `Dashboard.tsx`; `useMyTasks` è già condiviso.

## Verifica

- Typecheck `npx tsgo --noEmit -p tsconfig.app.json`, test `npx vitest run`, build.
- Controllo visivo: tab "La mia settimana" mostra Oggi + Focus + Le mie task senza aprire "Andamento"; dentro "Andamento" non ci sono doppioni.
