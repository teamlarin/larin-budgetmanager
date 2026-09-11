# Calendario: "Questo progetto non ha attività" anche quando ci sono

Nel dialog "Nuova attività manuale", scegliendo **Effedue - Sito web** con un utente team leader compare "Questo progetto non ha attività", ma il progetto ha 10 attività (esclusi i prodotti) e i permessi sul database le rendono leggibili a qualsiasi utente approvato: le verifiche fatte confermano che i dati e le regole di accesso sono a posto.

Il messaggio non distingue tre situazioni diverse: elenco vuoto, elenco ancora in caricamento, richiesta fallita. Oggi tutte e tre mostrano la stessa frase, quindi l'utente vede "non ha attività" anche quando le attività ci sono ma la lettura è in corso o è andata in errore.

## Cosa cambia

1. Durante il caricamento il campo Attività mostra uno stato "Caricamento attività..." al posto del messaggio di assenza.
2. Se la lettura non riesce, compare un avviso chiaro con pulsante **Riprova**, invece del messaggio fuorviante.
3. "Questo progetto non ha attività" resta solo quando la lettura è andata a buon fine e non ci sono davvero attività.
4. L'errore viene registrato nella console con il progetto interessato, così se il problema si ripresenta si vede subito la causa reale.
5. I due filtri "furbi" che escludevano righe per nome/categoria vengono resi più sicuri: le righe senza categoria non vengono più scartate per errore.

## Verifica

Dopo la modifica: aprire il calendario come team leader, creare un'attività manuale su **Effedue - Sito web** e controllare che le 10 attività compaiano; se compare invece l'avviso di errore, il messaggio in console indicherà il motivo esatto e potremo intervenire su quello.

## Note tecniche

- `src/components/CreateManualActivityDialog.tsx`: usare `isLoading`/`isError`/`refetch` della query `['project-all-activities', selectedProjectId]` per i tre stati del blocco Attività (righe ~427-505); sostituire `.neq('category','Import')` / `.neq('activity_name','Ore importate')` con un filtro in memoria (i `neq` di PostgREST scartano anche i valori `NULL`); aggiungere `console.error` nel `queryFn` in caso di errore.
- Nessuna modifica al database, alle RLS o ai permessi.
