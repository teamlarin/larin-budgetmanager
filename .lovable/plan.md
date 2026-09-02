# Progresso pack: ricalcolo quando cambiano le ore previste

## Cosa succede oggi

Il progetto "Funivie Marmolada - Lavorazioni grafiche (15 giornate)" ha:

- ore previste sulle attività: 34 + 50 + 16 + 20 = **120**
- ore confermate (time tracking): **58,4**
- progresso corretto: **49%**, ma nel database è salvato **98%**

Il progresso dei progetti pack/continuativi è un valore salvato sul progetto, aggiornato
automaticamente solo quando si inserisce, modifica o cancella una **registrazione ore**.
Se invece cambiano le **ore previste delle attività** (nuova attività, ore modificate,
attività eliminata) il valore non viene ricalcolato e resta congelato al rapporto vecchio.
In questo progetto è stata aggiunta l'attività "Lavorazioni Grafiche 2027" (50 ore) dopo
l'ultimo inserimento ore: il 98% è il residuo del calcolo precedente.

## Cosa faccio

1. **Ricalcolo automatico anche al cambio delle ore previste**: aggiungo lo stesso
   aggiornamento automatico già attivo sulle registrazioni ore anche quando si crea,
   modifica o elimina un'attività di budget del progetto (e quando cambia la sua natura
   prodotto/attività). Così il progresso resta sempre coerente con ore confermate / ore previste.
2. **Una sola formula condivisa**: la logica di calcolo viene estratta in un'unica routine
   riusata dai vari punti (registrazioni ore, attività, ricalcolo massivo), per evitare che
   le tre copie attuali divergano.
3. **Allineamento dei dati esistenti**: eseguo il ricalcolo su tutti i progetti pack e
   continuativi approvati e non completati, così i progressi già sbagliati (compresa
   Funivie Marmolada, che passerà a 49%) vengono corretti subito.
4. **Nessun avviso spurio**: le notifiche "90%" e "sforamento ore" restano legate solo al
   superamento effettivo della soglia, quindi il ricalcolo massivo non genererà notifiche
   retroattive.

## Note tecniche

- Migrazione SQL: funzione `public.recompute_project_progress(uuid)` con la formula
  `ore confermate / SUM(budget_items.hours_worked escluse le righe prodotto)`; il trigger
  esistente `trigger_update_pack_progress` su `activity_time_tracking` e
  `recalculate_all_pack_projects_progress()` la richiamano.
- Nuovo trigger su `budget_items` (AFTER INSERT / UPDATE OF `hours_worked`, `is_product`,
  `project_id` / DELETE) che chiama la stessa funzione.
- Update finale nella migrazione per riallineare i progetti già esistenti.
- Nessuna modifica alla UI: `ProjectCanvas` legge `projects.progress` e mostrerà il valore corretto.
