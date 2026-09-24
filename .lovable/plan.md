# Data di fine prevista nella notifica Slack

## Obiettivo
Aggiungere alle notifiche Slack dei Project Update la data di fine prevista e, quando la scadenza è già trascorsa mentre il progetto riceve ancora aggiornamenti, indicare il ritardo maturato a oggi.

## Modifiche
1. **Recupero affidabile del progetto**
   - Nella funzione che invia la notifica, usare il `project_id` già ricevuto per leggere direttamente la `end_date` dal progetto.
   - Mantenere il recupero per nome come compatibilità con eventuali versioni pubblicate meno recenti che non inviano ancora l’ID.
   - Eseguire questa lettura lato server, insieme al calcolo del margine residuo, senza affidarsi ai dati passati dalla schermata.

2. **Nuovo campo nella notifica di aggiornamento**
   - Aggiungere `Fine prevista: gg/mm/aaaa` tra i dati sintetici della notifica Slack.
   - Se il progetto non ha una data di fine, mostrare `Fine prevista: n.d.`.

3. **Scostamento richiesto: ritardo a oggi**
   - Se la data prevista è precedente alla data corrente e il progetto riceve ancora un update, mostrare ad esempio `Fine prevista: 15/09/2026 · in ritardo di 9 giorni`.
   - Se la scadenza è oggi o futura, mostrare solo la data, senza indicatori aggiuntivi.
   - Calcolare i giorni come giorni di calendario, trattando `end_date` come data pura per evitare spostamenti dovuti al fuso orario.

4. **Verifica**
   - Controllare la formattazione con scadenza futura, scadenza odierna, scadenza superata e data assente.
   - Verificare il controllo dei tipi, la build e i log della funzione senza inviare notifiche reali a Slack.

## Dettagli tecnici
- Intervento circoscritto a `send-slack-notification`; non servono nuove tabelle o modifiche ai dati.
- Il nuovo dato riguarda le notifiche `progress_update`; le notifiche di apertura e completamento progetto restano invariate.
