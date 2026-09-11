# Salute economica nel Cruscotto vendite

## Stato attuale verificato

- Il totale principale del cruscotto è oggi il **venduto delle offerte accettate**, non il fatturato emesso né l’incassato.
- La pagina Fatture possiede già valore offerta, fatturato emesso, incassato e residuo, ma non li confronta con un obiettivo.
- Il mix ricorrente/una tantum attuale misura il venduto per natura prodotto. Il vero **ricorrente mensile attivo** è già calcolato nella pagina Abbonamenti, ma non compare nel cruscotto.
- Il margine canonico per progetto considera ore interne valorizzate alla tariffa storica, overhead e costi esterni. Manca la vista aggregata per cliente e il dettaglio separato dei costi.
- Non esiste ancora un archivio di target commerciali annuali o mensili.

## Cosa verrà aggiunto

### 1. Fatturato effettivo, previsto e target

- Una fascia KPI con:
  - **Fatturato effettivo**: fatture emesse e incassate nell’anno selezionato.
  - **Fatturato previsto**: effettivo più fatture pianificate/in emissione, escludendo quelle annullate.
  - **Target annuale** e percentuale raggiunta.
  - **Scostamento** dal target alla data corrente.
- Un grafico mensile cumulativo con tre serie: effettivo, previsto e target stagionale.
- Un’impostazione dei target mensili per anno; la somma dei dodici mesi costituisce il target annuale. Admin e finance potranno modificarli, account potrà consultarli.
- Il selettore anno esistente governerà tutti gli indicatori della pagina.

### 2. MRR e prevedibilità

- KPI **MRR attivo**, **ARR equivalente**, quota a rischio nei prossimi 90 giorni e numero di abbonamenti attivi.
- Confronto chiaro tra ricavi ricorrenti attivi e venduto una tantum, senza chiamare “MRR” il valore totale delle offerte ricorrenti.
- Dettaglio per cliente dei canoni attivi, con collegamento alla sezione Abbonamenti.
- Il mix offerte ricorrenti/una tantum già presente resterà disponibile, ma sarà etichettato come mix del venduto per evitare ambiguità.

### 3. Margine per progetto e cliente

- Tabella per progetto con cliente, valore/budget attività, costo ore interne, costi esterni, profitto residuo in euro e margine percentuale.
- Vista aggregata per cliente, ottenuta sommando valore e costi dei relativi progetti; il margine percentuale sarà calcolato sui totali, non come media delle percentuali.
- Ordinamento per profitto o margine e segnalazione dei valori negativi.
- Riutilizzo della formula canonica già adottata nel resto dell’app, inclusi tariffe storiche, overhead e `project_additional_costs`, così il dato resta coerente con la scheda progetto.

## Struttura della pagina

1. Indicatori economici principali.
2. Andamento mensile effettivo / previsto / target.
3. Prevedibilità: MRR, rischio rinnovi e mix del venduto.
4. Marginalità, con selettore **Per progetto / Per cliente**.
5. Analisi commerciali già presenti: categorie, prodotti, conversione e venduto per commerciale.

## Dettagli tecnici

- Aggiungere una tabella per i target mensili, con grant espliciti, RLS e permessi di modifica limitati ad admin/finance.
- Aggiungere viste o funzioni di sola lettura per andamento fatture, MRR per cliente e marginalità, senza esporre compensi o tariffe individuali.
- Basare il fatturato sulle date delle righe di fatturazione; mantenere distinti `emessa/incassata` da `prevista/in_emissione`.
- Gestire paginazione e aggregazioni lato database per non incorrere nel limite di 1.000 righe.
- Aggiornare hook, tipi e componenti del cruscotto; aggiungere stati di caricamento, assenza dati ed errore coerenti con l’interfaccia esistente.
- Aggiungere test per classificazione fatture, somma target, normalizzazione MRR e aggregazione ponderata del margine.

## Verifica finale

- Confrontare i totali del cruscotto con Fatture e Abbonamenti sullo stesso anno.
- Confrontare un campione di margini con le rispettive schede progetto.
- Verificare ruoli admin, finance e account, selettore anno, tema chiaro/scuro e layout desktop/mobile.
