# Planner: distribuire le ore sui giorni in base al contratto

## Come funziona oggi

Quando nel Planner indichi le ore previste della settimana per un'attività, le ore vengono spalmate sui giorni utili partendo dal primo giorno disponibile e riempiendolo **fino all'orario di fine giornata delle impostazioni calendario** (di norma 08:00–18:00, cioè 10 ore). Solo quando quel giorno è pieno si passa al successivo. Risultato: 20 ore diventano 10h lunedì + 10h martedì, anche se la persona ha un contratto da 6 ore al giorno, e mercoledì–venerdì restano vuoti.

## Cosa cambia

1. Il riempimento di ogni giornata non arriva più fino all'orario di fine, ma si ferma alle **ore giornaliere da contratto** della persona (letto dal riferimento contrattuale: periodi contrattuali, con ripiego sul profilo).
   - contratto giornaliero: le ore indicate;
   - contratto settimanale: ore settimana ÷ giorni lavorativi della settimana;
   - contratto mensile: riportato prima a settimana e poi a giorno.
2. Le ore già occupate della giornata (altre attività pianificate o confermate, assenze) contano nel tetto: se lunedì ci sono già 4h e il contratto è 8h, il Planner ne aggiunge al massimo 4.
3. La distribuzione diventa **equilibrata**: le ore vengono ripartite sui giorni utili della settimana in passaggi successivi, così una richiesta di 20h su 5 giorni da 8h dà 4h al giorno invece di 8+8+4.
4. L'orario resta reale: dentro ogni giorno lo slot viene accodato dopo gli impegni già presenti, sempre entro l'orario di inizio/fine giornata delle impostazioni (che resta il limite invalicabile esterno).
5. Se le ore richieste superano la capacità contrattuale della settimana, il residuo viene segnalato con l'avviso già esistente ("Ore pianificate solo in parte"), senza sfondare le giornate.
6. Se per una persona non risulta nessun riferimento contrattuale, si continua come oggi con l'orario di fine giornata come tetto.

Vale sia per "Aggiungi attività"/modifica riga sia per il trascinamento di un'attività dalla sidebar nel Planner e per lo spostamento di una riga da una settimana all'altra.

## Note tecniche

- `src/components/calendar/planningUtils.ts`: `distributeMinutesAcrossDays` acquisisce `dailyCapMinutes?: number` e un ciclo a passaggi multipli (round-robin sui giorni) invece del riempimento sequenziale; per ogni giorno il limite è `min(workDayEnd, cursor + capResidua)` dove la capacità residua sottrae i minuti già occupati dal `busyByDate` di quel giorno. Nessun cambio di firma per `getPlannableDays`/`buildBusyMap`.
- `src/pages/Calendar.tsx`: `planWeeklyHoursMutation` (e i percorsi drag & drop / spostamento settimana) usano `useContractResolver([viewingUserId])` + `grossCapacityHours` di `src/lib/capacity.ts` per ricavare le ore giornaliere: `grossCapacityHours(hours, period, daysToUse.length) / daysToUse.length`, convertite in minuti e arrotondate al quarto d'ora; `dailyCapMinutes` viene passato a `distributeMinutesAcrossDays` solo quando il contratto dà un valore > 0.
- Nessuna modifica al database e nessuna nuova query oltre a quella già cacheata dei contratti (`queryKey: ['contracts', ...]`).
- Date sempre con `format(date, 'yyyy-MM-dd')`.
- Nuovi test in `src/test/` per `distributeMinutesAcrossDays`: 20h su 5 giorni con tetto 8h → 4h al giorno; giornata già occupata → tetto rispettato; richiesta oltre la capacità → minuti non allocati restituiti.
