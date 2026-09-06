# "Le mie task" nella sezione Focus

Oggi il widget "Le mie task" è renderizzato dentro `MemberDashboard`, che nella tab "La mia settimana" finisce dentro l'accordion "Andamento" (chiuso di default). Lo sposto nella sezione **Focus**, visibile subito.

## Cosa cambia per l'utente

- Nella tab "La mia settimana", sotto la lista Focus (progetti + task urgenti), compare una sotto-sezione **"Tutte le mie task"** con il widget esistente: raggruppamento per scadenza, checkbox di completamento, contatori, "Mostra tutte".
- L'accordion "Andamento" non contiene più il widget task; il resto (grafici, ore, progetti) resta invariato.
- Il widget rispetta il filtro area già presente nella sezione Focus? No: resta su tutte le task dell'utente, perché raggruppa per scadenza e non per progetto/area. Il filtro area continua a valere solo per la lista Focus sopra.

## Dettagli tecnici

- `src/components/dashboards/MemberDashboard.tsx`: rimuovere l'import e la riga `<MyTasksWidget userId={userId} />` (linea ~278). Il componente resta usato altrove solo qui, quindi nessun altro punto da toccare.
- `src/components/dashboards/WeeklyFocusView.tsx`: importare `MyTasksWidget` e renderizzarlo in fondo alla sezione Focus (dopo la lista `rows` e prima del link "Tutti i progetti"), con un titolo di sotto-sezione coerente ("Le mie task") e `userId` già disponibile nelle props.
- Nessuna modifica a hook, query o dati: `useMyTasks` è già usato sia dal widget sia dal focus, quindi nessuna fetch aggiuntiva.

## Verifica

- Typecheck `npx tsgo --noEmit -p tsconfig.app.json` e build.
- Controllo visivo della tab "La mia settimana": widget visibile senza aprire l'accordion, assente dentro "Andamento".
