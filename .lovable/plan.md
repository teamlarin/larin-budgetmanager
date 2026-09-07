# Ore pianificate arrotondate male nella tab Team

## Cosa ho verificato

Per Giorgio Maria Sacchi, nella settimana 7–13 settembre ci sono esattamente tre slot pianificati:

- Assofondi – Sito web istituzionale: 09:15 → 11:00 = 1h 45m (confermate 1h 45m)
- Management & pianificazione 2026: 11:00 → 12:00 = 1h (confermata 1h)
- Meeting interni e formazione 2026: 15:30 → 16:30 = 1h (non confermata)

Totale reale pianificato: **3h 45m**. La tab Team mostra 3h 48m, e la riga Assofondi mostra 1h 48m invece di 1h 45m.

## Perché

Le ore vengono arrotondate a un decimale prima di essere mostrate. Un decimo di ora sono 6 minuti, quindi 1h 45m (1,75) diventa 1,8 → mostrato come "1h 48m". Lo stesso vale per le confermate (2h 45m → 2h 48m) e per qualunque orario che non cade su un multiplo di 6 minuti: i quarti d'ora vengono sempre falsati di 3 minuti. Non è un problema del calendario né dei dati: è solo la presentazione.

## Cosa cambio

Passare dall'arrotondamento a decimi di ora all'arrotondamento **al minuto**, così i valori mostrati corrispondono sempre agli orari degli slot.

- Ore per persona, per giorno, per progetto e per singolo slot: arrotondamento al minuto.
- Capacità, assenze, ore libere e percentuali: stessa regola, così le somme restano coerenti (pianificato + libere = capacità).
- Nessuna modifica al calendario, ai dati salvati o alla logica di calcolo delle durate.

## Dettagli tecnici

- `src/lib/capacity.ts`: in `buildCapacityBreakdown` sostituire `round(n) = Math.round(n*10)/10` con un arrotondamento al minuto (`Math.round(n*60)/60`); esportarlo come helper `roundToMinute` riutilizzabile.
- `src/hooks/useTeamWeek.ts`: il `round` locale usa lo stesso helper per `byDay`, `byProject`, `slots.hours` e `unconfirmedPastHours`.
- `src/test/capacity.test.ts`: aggiungere un caso 1,75h + 1h + 1h → 3,75h che, formattato, dà "3h 45m", e verificare che `capacityNet - plannedHours = freeHours` senza deriva.
- Verifica finale con typecheck (`tsgo`) e `vitest`.
