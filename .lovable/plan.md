

## Aggiungere previsionale nel saldo mensile

### Obiettivo
Per il mese corrente, mostrare tra parentesi il saldo previsionale che si otterrebbe se l'utente lavorasse le ore da contratto nei giorni lavorativi rimanenti del mese.

### Logica

Per il mese corrente:
- **Saldo attuale** = (ore confermate + rettifica) - ore previste fino a fine mese
- **Previsionale** = saldo attuale + (ore da contratto giornaliere × giorni lavorativi rimanenti nel mese) - (ore previste rimanenti)

In pratica, il previsionale equivale a: `(ore confermate + rettifica + ore_contratto_rimanenti) - ore_previste_mese`, cioè il saldo a fine mese se l'utente rispetta il contratto. Questo si semplifica a **0** (o quasi) se ore contratto = ore previste, ma può differire se ci sono rettifiche o scostamenti accumulati.

Calcolo più semplice: `balance + (expected_remaining - expected_remaining) = balance` solo se il contratto copre tutti i giorni. Quindi il vero valore è: **saldo attuale + ore previste rimanenti nel mese - ore previste rimanenti = saldo attuale** se l'utente farà esattamente le ore previste. Dunque il previsionale è semplicemente il saldo corrente proiettato: le ore mancanti da oggi a fine mese verrebbero coperte dal contratto, quindi il saldo rimarrebbe uguale.

In realtà il valore utile è: **ore confermate ad oggi + ore previste da domani a fine mese - ore previste intero mese + rettifica** = mostrare quanto il saldo "migliorerebbe" con le ore rimanenti.

Riformulando: il saldo attuale usa le ore previste dell'intero mese ma le confermate sono solo fino ad oggi. Il previsionale aggiunge le ore che verrebbero fatte (= ore previste da domani a fine mese) alle confermate, dando un saldo pari a: `(confirmed + adjustment + expected_remaining) - expected_total`.

### Modifiche — `src/components/ProfileHoursBank.tsx`

1. **Calcolo `expectedRemaining`**: per il mese corrente, calcolare le ore previste dal giorno successivo a oggi fino a fine mese usando `calculateExpectedHoursForMonth(tomorrow, endOfMonth)`.

2. **Calcolo `forecastBalance`**: `balance + expectedRemaining` — cioè il saldo che si avrebbe a fine mese facendo le ore da contratto.

3. **Visualizzazione**: nella cella Saldo del mese corrente, dopo il saldo attuale aggiungere tra parentesi il previsionale in grigio:
   ```
   -2h 45m (prev. +0h 15m)
   ```

### File modificato
- `src/components/ProfileHoursBank.tsx`

