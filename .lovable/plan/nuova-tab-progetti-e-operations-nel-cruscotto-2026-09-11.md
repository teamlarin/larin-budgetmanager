# Nuova tab "Progetti e operations" nel cruscotto

Terza tab accanto a Vendite e Fatturato, con gli indicatori di efficienza produttiva e la soddisfazione dei clienti letta dal foglio Google.

## Selettore di periodo

Dentro la tab: mese corrente, trimestre corrente o anno intero (l'anno resta quello scelto in alto). Ogni indicatore si ricalcola sul periodo scelto.

## Indicatori

### 1. Tasso di utilizzo del team
- Ore confermate su progetti fatturabili diviso ore lavorabili nette del periodo (contratto meno assenze Larin OFF).
- Escluse assenze, progetti di area interno e progetti non fatturabili.
- Fascia di riferimento 70–80%: verde dentro la fascia, ambra sotto, rosso sopra il 90%.
- Dettaglio per persona espandibile: ore fatturabili, ore non fatturabili, capacità netta, percentuale.

### 2. Deviazione del budget ore (scope creep)
- Per progetto: ore preventivate (somma attività) contro ore effettive registrate, con scostamento percentuale.
- Tabella ordinabile su tutte le colonne, ricerca, 10 righe per pagina.
- Evidenza rossa oltre +20%, ambra tra +5% e +20%.
- In alto lo scostamento medio del periodo.

### 3. Consegne in tempo (OTD)
- Percentuale di progetti passati a "completato" entro la data di fine prevista, nel periodo scelto.
- Elenco dei progetti in ritardo con i giorni di scostamento.
- I progetti senza data di fine sono esclusi dal calcolo e conteggiati a parte.

### 4. Capacità residua (saturazione)
- Ore ancora libere del team nel mese e nel trimestre: capacità netta meno ore già pianificate.
- Barra di saturazione con soglia di sovraccarico e ripartizione per area.

### 5. Customer satisfaction per progetto
- Letta in diretta dal foglio "Database Customer Satisfaction" (colonne Cliente, Progetto, NPS, area, tipologia, note).
- NPS medio del periodo, distribuzione promotori/passivi/detrattori e tabella per progetto con i commenti.
- Il progetto viene abbinato per nome; le risposte non abbinabili restano visibili come "progetto non collegato".
- Oggi il foglio contiene solo le intestazioni: la sezione mostrerà uno stato "nessuna risposta ancora" finché non arrivano compilazioni.

## Dettagli tecnici

- Nuovo file `src/components/sales/OperationsSection.tsx` più sottosezioni (`UtilizationSection`, `ScopeCreepTable`, `OnTimeDeliverySection`, `RemainingCapacitySection`, `SatisfactionSection`) e hook in `useSalesData.ts`.
- Calcoli puri in `src/lib/operationsMetrics.ts` (utilizzo, scostamento ore, OTD, saturazione) con test in `src/test/`; riuso di `capacity.ts` per capacità netta e assenze, `contractPeriods.ts` per le ore da contratto e degli stessi filtri di esclusione già usati per la marginalità.
- Ore effettive da `activity_time_tracking` e ore preventivate da `budget_items`, con lettura paginata a blocchi da 1.000 righe per superare il limite PostgREST.
- OTD basato sul passaggio di stato a `completato` (log di audit progetto quando disponibile, altrimenti `status_changed_at`) confrontato con `end_date`.
- Nuova Edge Function `customer-satisfaction-sheet` che legge il foglio tramite il connettore Google Sheets attraverso il gateway; nessuna chiave nel browser, risposta in cache lato client per qualche minuto. Serve collegare al progetto la connessione Google Sheets già presente nel workspace.
- Nessuna modifica a formule di marginalità, permessi o dati esistenti.

## Verifica finale

- Controllo delle tre tab su desktop e mobile e del cambio periodo mese/trimestre/anno.
- Confronto a campione dei valori di utilizzo e ore effettive con il riepilogo ore team.
- Verifica dello stato vuoto della soddisfazione e del comportamento in caso di foglio non raggiungibile.
- Test e controllo di compilazione.
