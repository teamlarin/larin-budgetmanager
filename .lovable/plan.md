# Margine residuo ancora "n.d." su Slack

## Diagnosi
- I progetti hanno i dati per il calcolo (es. "IOV - Restyling sito web Donazioni": budget attività 9.490 €), quindi il valore non manca.
- Il calcolo lato server parte solo se arriva l'identificativo del progetto. La versione pubblicata dell'app (budget.larin.it) non lo invia ancora, quindi il calcolo viene saltato. La causa non è confermata al 100%: i log attuali non dicono se il calcolo è partito.

## Interventi
1. Nella funzione che invia a Slack: se manca l'identificativo, trovare il progetto dal nome. Così il margine compare anche con la versione pubblicata di oggi.
2. Aggiungere ai log una riga con il margine calcolato, o il motivo per cui manca, per poter controllare subito.
3. Pubblicare di nuovo la funzione e fare un invio di prova sul progetto IOV Donazioni. Poi controllare i log e confermare che il margine sia un numero.
4. Consigliare di ripubblicare l'app.

## Dettagli tecnici
- `send-slack-notification`: se `project_id` manca, `select id from projects where name = project_name limit 1` con il client service role. Poi `getProjectResidualMargin`, con `console.log` del risultato e degli eventuali errori.
