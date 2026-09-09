# Perché la lista mostra 100% e la scheda -4,1%

## Cosa ho verificato

Sul progetto Meccanostampi - Fiera Fakuma:

- budget attività: 1.500 € (valore impostato a mano);
- 42 registrazioni di tempo confermate, 33,75 ore, di cinque persone;
- costi esterni: 0 €; costi generali: 30 €/ora.

Con questi dati il costo del lavoro è circa 1.590 €, quindi il margine residuo è negativo: la scheda progetto (-4,1%) è corretta.

La lista mostra 100% perché **il calcolo condiviso non è aggiornato sul server**. I registri del servizio che alimenta le liste mostrano ancora la versione vecchia (righe di debug rimosse giorni fa, e per ogni progetto il budget calcolato risulta 0). Per Fakuma quella versione non trova le ore, quindi il costo del lavoro è 0 e il margine risulta 100%. Non è un problema della lista, né dei dati: è la versione del calcolo che sta girando.

Questo spiega anche gli altri progetti con 100% in lista e valori sensati nella scheda.

## Cosa faccio

1. Pubblico sul server la versione aggiornata del calcolo margini, quella già allineata alla scheda progetto (stesso budget attività, stesse tariffe valide alla data della registrazione, stessi costi esterni).
2. Verifico subito dopo che per Fakuma il valore restituito sia negativo e coincida con la scheda, e che gli altri progetti Meccanostampi restino coerenti.
3. Controllo un campione di progetti che oggi mostrano 100%: dopo l'aggiornamento devono mostrare il margine reale, oppure "—" quando non è calcolabile (nessun budget attività e nessun costo), mai un finto 100%.
4. Svuoto la cache dei margini nelle viste (lista progetti, lista budget, cruscotto) così il nuovo valore compare senza dover ricaricare a mano.

Nessuna modifica ai permessi e nessun cambio di dati: solo il calcolo che torna a essere uno solo per tutte le viste.

## Dettagli tecnici

- Deploy di `supabase/functions/calculate-project-margins` (Supabase esterno: il deploy automatico non parte, va eseguito esplicitamente). Il codice locale è già quello corretto: `activitiesBudget` esplicito, `residualMargin: number | null`, blocco `[MARGIN DEBUG]` rimosso, tariffe per data con fallback profilo.
- Verifica post-deploy con invocazione diretta della funzione su `project_ids: ['bacc40f8-6820-488a-9399-63c17b9a088c']` più un campione di progetti a 100%, e lettura dei log per confermare che le righe `[MARGIN DEBUG]` non compaiano più.
- Nessuna migrazione: `get_contract_rate_periods_for_costing` è già in produzione e i consumatori lato client gestiscono già il margine nullable.
