# Spostamento timesheet Angelica Vuocolo (YORU)

## Cosa viene spostato
- Da: **YORU - Marketing operativo 2026** → attività "Grafiche social"
- A: **YORU - Lavorazioni grafiche (10 giornate)** → attività "Lavorazioni grafiche"
- Solo le registrazioni di Angelica Vuocolo dal 01/04/2026 in poi: **96 slot** (01/04 – 28/09/2026), di cui 95 confermati, circa 116,5 ore. Nessuno è collegato a task.

## Effetti
- Le ore e i costi passano dal primo al secondo progetto (consuntivo, margine e avanzamento si aggiornano per entrambi).
- Date, orari, note e stato di conferma restano invariati.
- Le registrazioni di altre persone o precedenti al 01/04 non vengono toccate.

## Dettagli tecnici
- Un solo aggiornamento dati su `activity_time_tracking`: `budget_item_id` da `5d6f13f1-…` a `1e545bb7-…` filtrato per utente Angelica e `scheduled_date >= '2026-04-01'`.
- Poi ricalcolo dell'avanzamento dei due progetti e controllo che i conteggi coincidano (96 righe spostate, 0 rimaste).
