# La mia settimana: una sola dashboard personale

Oggi "Il mio Recap" e "Focus Settimana" raccontano la stessa settimana con numeri diversi e nessuna gerarchia. Le unifico in un'unica tab **La mia settimana**, orientata alla decisione: capacità, ore da recuperare, focus (progetti + task) con il motivo esplicito. Tutto il resto scende in un accordion "Andamento".

## Gerarchia della nuova tab

1. **Barra capacità** (una riga, non una card): ore pianificate settimana su ore contrattuali settimanali, con le ore già confermate evidenziate nella stessa barra. I tre valori esistono già nei dati passati alla dashboard (`weekPlannedHours`, `weekConfirmedHours`, `weeklyContractHours`).
2. **Da recuperare**: ore pianificate nei giorni **passati** e mai confermate (slot con orario pianificato ma senza orario effettivo), raggruppate per giorno, con azione "Conferma ore" che porta al calendario sul giorno giusto. Include anche il conteggio del **mese precedente** ancora aperto.
3. **Focus**: lista unica **progetti + task**, ordinata per punteggio, ogni riga con:
   - chip del motivo ("scade giovedì", "budget al 92%", "fermo da 3 settimane", "in ritardo di 2 giorni", "6h pianificate")
   - azione inline contestuale: task → "Completa"; progetto → "Aggiorna progresso", "Pianifica", "Apri canvas".
4. **Andamento** (accordion chiuso di default): trend produttività, ore del mese, ore per progetto, ore per tipo attività, attività di oggi/prossime, progetti come leader/member — cioè l'attuale contenuto del Recap, invariato.

## Scoring: completato e spiegato

- **Consumo budget reale**: aggiungo la query mancante (ore confermate di tutti gli utenti sulle attività del progetto, in batch da 100 come già si fa) per calcolare `budgetConsumedPct` = ore confermate / ore previste. Con questo attivo i punti oggi mai assegnati: budget ≥ 90% → +25, ≥ 75% → +10.
- **Task nel punteggio**: le task assegnate all'utente entrano nella stessa lista. Punteggio da scadenza (in ritardo, oggi/domani, entro settimana) e priorità (alta/normale/bassa), più un bonus se la task appartiene a un progetto già urgente.
- **Soglie ricalibrate** sul massimo reale (che sale a 100), così un progetto all'85% di budget senza deadline imminente emerge comunque come urgente.
- **Motivi**: ogni item porta una lista di motivi generati insieme al punteggio, mostrati come chip. Il punteggio non è più un bollino opaco.

## Apertura di default

Resta il default sul focus il lunedì, esteso: **se ci sono ore pianificate non confermate del mese precedente**, la dashboard si apre su "La mia settimana" con il blocco "Da recuperare" in evidenza in qualunque giorno.

## Dettagli tecnici

- `src/hooks/useWeeklyFocus.ts`: aggiungere la query ore confermate per progetto (rimuovendo lo stub `const budgetConsumedPct: number | null = null` e il commento), estendere `FocusItem` con `reasons: string[]`, unificare la sorgente task riusando `useMyTasks` e restituire un tipo unione (`kind: 'project' | 'task'`) ordinato per score. Nessun cambio di schema.
- `src/components/dashboards/WeeklyFocusView.tsx`: diventa la vista completa "La mia settimana" con barra capacità, blocco "Da recuperare", lista unificata con chip motivo e azioni inline (`ProgressUpdateDialog`, `useCompleteMyTask`, link al calendario).
- `src/components/dashboards/TabbedDashboard.tsx`: la tab `recap` diventa "La mia settimana"; `MemberDashboard` viene renderizzato dentro un accordion "Andamento" in fondo alla stessa tab; la tab `focus` separata sparisce; logica di default estesa al mese precedente non confermato.
- `src/components/dashboards/MemberDashboard.tsx`: nessuna riscrittura, solo l'opzione di nascondere le card ore/oggi già mostrate sopra per evitare doppioni.
- Ore da recuperare: da `activity_time_tracking` dell'utente, slot con `scheduled_start_time`/`scheduled_end_time` valorizzati e `actual_start_time`/`actual_end_time` mancanti, con `scheduled_date` precedente a oggi (settimana corrente + mese precedente).
- Le tab di ruolo (team leader, account, ecc.) restano dove sono.
