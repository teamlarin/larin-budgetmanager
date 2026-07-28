## Problema
Sul progetto "Marchon - Video AI 4 brand", l'attività "Gen AI + montaggio video" ha uno slot pianificato con data **22/06/2022** 14:00–19:00 (5h) assegnato ad Angelica Vuocolo. La data nel passato lontano fa sì che lo slot conti nelle ore pianificate del progetto ma non compaia nel calendario "da confermare" (finestra corrente/futura).

## Fix
Eliminare il singolo record `activity_time_tracking` con id `e2cc97ca-c498-487c-88eb-e06c1370b2ad` (scheduled_date 2022-06-22, 14:00–19:00, user Angelica Vuocolo, senza actual_start/end).

Effetto: le 5h pianificate scompaiono dal totale del progetto e il conteggio torna coerente. Nessun impatto sulle ore confermate/contabili.

## Dettagli tecnici
```sql
DELETE FROM activity_time_tracking WHERE id = 'e2cc97ca-c498-487c-88eb-e06c1370b2ad';
```
Verificato: `actual_start_time` e `actual_end_time` sono NULL, quindi lo slot è puramente pianificato.
