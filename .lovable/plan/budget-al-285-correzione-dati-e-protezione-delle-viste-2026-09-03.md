# Budget al 285%: correzione dati e protezione delle viste

## Cosa succede oggi

Nel progetto "Unione Montana Comelico - Sito web Val Comelico" la percentuale budget è il rapporto ore confermate / ore previste:

- ore confermate: 114h (Management 34,75h, Grafica 18,50h, Ore importate 60,75h)
- ore previste nelle attività: 40h (Management 20h, Grafica 20h, "Ore importate" 0h)

114 / 40 = 285%. Il margine residuo 37,5% non usa le ore ma il budget attività manuale (17.000 € meno 10.625 € di costo del lavoro), quindi resta positivo; il progresso 100% è impostato a mano. Quindi il problema è il denominatore: la voce "Ore importate" ha 0 ore previste pur avendo 60,75h registrate.

## Intervento 1 — Correggere i dati del progetto

Migrazione una tantum sulle voci attività di questo progetto:

- portare le ore previste della voce "Ore importate" a 61h (le ore effettivamente registrate su quella voce), così le ore previste totali passano da 40h a 101h.
- lasciare invariati Management e Grafica: il loro superamento (34,75h su 20h) è un dato reale da vedere.

Risultato atteso: budget ~113% invece di 285%, coerente con un progetto al 100% di avanzamento e leggermente sopra la stima.

## Intervento 2 — Rendere robuste le viste

Nella sorgente unica di criticità (`projectCriticality`) si aggiunge il concetto di "ore previste non attendibili":

- se le ore previste sono 0/assenti, oppure sono inferiori alle ore confermate di oltre il 50%, la percentuale budget non viene calcolata: nelle liste si mostra "—" invece di un valore fuori scala.
- in questi casi il progetto non entra nel gruppo "A rischio" per il solo motivo budget (margine, scadenze e proiezione continuano a valere).
- tra i motivi di criticità compare "ore previste da completare", così il team leader capisce che va sistemata la pianificazione, e la cella "—" mostra in tooltip le ore confermate e quelle previste.

Le viste interessate (tab Progetti della dashboard, Progetti Approvati, focus settimanale) ereditano il comportamento senza logiche duplicate, perché leggono già da quella funzione.

## Dettagli tecnici

- `src/lib/projectCriticality.ts`: nuovo helper `plannedHoursUnreliable(totalHours, confirmedHours)`; in `evaluateProjectCriticality` `budgetPct` resta `null` quando la condizione è vera, si aggiunge `budget.unreliable: boolean` a `CriticalitySignals` e si esclude il contributo budget da `atRisk`; nuovo motivo testuale.
- `src/components/dashboards/ProjectsGroupedView.tsx` e le altre viste che stampano `s?.budget.pct`: mostrano `—` con tooltip (ore confermate vs previste) quando `budget.unreliable`.
- Migrazione dati: `UPDATE public.budget_items SET hours_worked = 61 WHERE id = 'ebc9a338-2f47-4567-95e2-ee33e927d25a'` (voce "Ore importate" del progetto `c6054e50…`), senza modifiche di schema.
- Test unitari su `plannedHoursUnreliable` e sui casi 114/40, 114/101 e 0 ore previste; verifica con typecheck e vitest.
