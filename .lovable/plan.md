# Tab Progetti: mese chiuso, indicatori sintetici

## 1. Tasso di utilizzo: escludere il mese in corso

Il mese corrente non è ancora pianificato/confermato del tutto, quindi falsa la percentuale.

- Il periodo di riferimento diventa l'ultimo mese **chiuso**: se oggi è settembre, il mese di default è agosto.
- Trimestre: si considerano solo i mesi già chiusi del trimestre (il mese in corso è escluso); se il trimestre ha solo il mese in corso, si usa il trimestre precedente.
- Anno: si considerano i mesi da gennaio all'ultimo mese chiuso.
- Sotto il valore compare l'etichetta del periodo effettivamente conteggiato (es. "agosto 2026") e una nota che il mese in corso è escluso perché incompleto.

## 2. Navigazione del mese

- Accanto al selettore Mese / Trimestre / Anno arrivano le frecce avanti/indietro per spostarsi di mese (o trimestre) e un pulsante per tornare all'ultimo periodo chiuso.
- Non si può andare oltre l'ultimo periodo chiuso; indietro si può risalire fino a gennaio dell'anno selezionato.
- Il cambio di periodo aggiorna utilizzo, deviazione ore, consegne, capacità residua e customer satisfaction, coerentemente.

## 3. Deviazione del budget ore: solo indicatori

La tabella completa lascia il posto a quattro numeri:

- scostamento medio %;
- progetti sopra il preventivo (oltre +5%);
- progetti critici (oltre +20%);
- ore in eccesso totali rispetto al preventivo.

Sotto, un link "Vedi dettaglio progetti" apre la tabella esistente (ricerca, ordinamento, 10 righe per pagina) in un pannello richiudibile, così il dettaglio resta accessibile senza occupare la pagina.

## 4. Customer satisfaction: solo indicatori

Al posto della tabella:

- risposte raccolte nel periodo;
- punteggio medio;
- indice NPS;
- promotori / passivi / detrattori.

Più una piccola griglia con il punteggio medio e il numero di risposte **per area**, e in aggiunta per tipologia di progetto e disciplina, selezionabili con un piccolo selettore. Il dettaglio delle singole risposte (commenti compresi) resta dietro un link "Vedi le risposte", nello stesso pannello richiudibile.

## Dettagli tecnici

- `src/lib/operationsMetrics.ts`: `operationsPeriodRange` viene esteso per lavorare su un mese/trimestre di ancoraggio esplicito e per troncare l'intervallo alla fine dell'ultimo mese chiuso; nuove funzioni pure `scopeCreepSummary(rows)` e `satisfactionBreakdown(rows, key)` con test dedicati in `src/test/operations-metrics.test.ts`.
- `src/components/sales/OperationsSection.tsx`: stato del periodo con offset navigabile, passato invariato agli hook (query key aggiornata per invalidare la cache).
- `src/components/sales/ScopeCreepTable.tsx` e `SatisfactionSection.tsx` restano come viste di dettaglio, incapsulate in un collapsible; i nuovi riepiloghi vivono in due componenti sintetici accanto a loro.
- Nessuna modifica a query, formule di marginalità, permessi o Edge Function della customer satisfaction.

## Verifica

- Controllo che il mese di default sia quello chiuso e che le frecce non superino il limite.
- Confronto dei numeri sintetici con i totali della tabella di dettaglio.
- Test unitari, typecheck e build.
