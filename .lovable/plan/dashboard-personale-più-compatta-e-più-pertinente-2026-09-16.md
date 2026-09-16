# Dashboard personale più compatta e più pertinente

## 1. Perché vedi "Assofondi - Sito web Futura"

Verificato: in quel progetto il responsabile è Giulia Sordi e l'account Alberto Nalin, ma tu sei nell'elenco dei membri del team. Oggi il focus prende tutti i progetti dove compari come membro, anche senza ore pianificate né task tue: per questo appare.

**Nuova regola.** Nel focus entra un progetto solo se:
- sei responsabile, account o utente assegnato del progetto, **oppure**
- hai ore pianificate nella settimana su quel progetto, **oppure**
- hai una task assegnata su quel progetto.

La sola appartenenza al team non basta più. I progetti esclusi restano raggiungibili da "Tutti i progetti" (e le task assegnate continuano a comparire come task, con il loro progetto indicato).

## 2. Blocco "Oggi" più corto

- Restano visibili solo le attività ancora da confermare.
- Le confermate si riducono a una riga di riepilogo: "6 confermate", cliccabile per aprirle quando servono.
- Se per oggi è tutto confermato, il blocco resta come singola riga di riepilogo invece di sei righe.

## 3. Focus più compatto e su due colonne

- Meno spazio verticale per riga, chip più piccoli, cliente e motivi su una riga sola quando c'è spazio.
- I gruppi "Urgente" e "Da tenere d'occhio" passano a due colonne su schermi larghi; su schermi stretti tornano a una colonna.
- "Da fare subito" resta a piena larghezza in cima (è la parte che devi leggere per prima).
- "In corso" resta chiuso di default.

Restano invariati: barra capacità, "Da recuperare", filtro area, punteggio e ordinamento.

## Dettagli tecnici

- `src/hooks/useWeeklyFocus.ts`: nella query dei progetti distinguere le fonti (membership vs leader/account/assigned) e applicare il filtro di pertinenza dopo il calcolo di `userPlannedHours` e dei `project_id` delle task di `useMyTasks`. Il filtro sulle task passa in `useWeekFocusRows`, dove entrambe le liste sono disponibili; `useWeeklyFocus` espone un flag `isOwner` per riga così il filtro resta un solo punto di verità.
- `src/components/dashboards/WeeklyFocusView.tsx`: blocco "Oggi" con `Collapsible` per le confermate (`todaysList.filter(a => a.is_confirmed)`) e contatore; righe focus con padding ridotto; wrapper `grid gap-2 lg:grid-cols-2` per i gruppi `urgent`/`soon`, mantenendo `divide-y` solo nel layout a una colonna.
- Nessuna modifica a database, RLS o al calcolo del punteggio.
