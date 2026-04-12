

## Notifiche "Attenzione Budget" a soglie progressive (50%, 75%, 90%)

### Situazione attuale
Esiste un solo alert `budget_warning` che scatta quando il consumo raggiunge `100 - margine%` del budget attività. L'utente vuole invece 3 notifiche progressive basate sul **budget target** (= budget attività × (1 - margine%)).

### Logica nuova
Calcolare `targetConsumptionPercentage = (totalSpent / targetBudget) × 100` e inviare notifiche a:
- **50%** del budget target → tipo `budget_warning_50`, livello warning
- **75%** del budget target → tipo `budget_warning_75`, livello warning  
- **90%** del budget target → tipo `budget_warning_90`, livello critical

Ogni soglia ha un tipo distinto per evitare duplicati (il sistema anti-spam già controlla `project_id + type` nelle ultime 24h).

Il vecchio alert `budget_warning` (basato su `100 - margine%`) viene rimosso e sostituito da queste 3 soglie.

L'alert `budget_exceeded` (consumo ≥ 100% del budget attività) resta invariato.

### Esempio concreto
Progetto con budget attività 10.000€ e margine 30% → target = 7.000€:
- A 3.500€ spesi → notifica 50%
- A 5.250€ spesi → notifica 75%
- A 6.300€ spesi → notifica 90%
- A 10.000€ spesi → budget_exceeded (già esistente)

### File modificato
**`supabase/functions/check-margin-alerts/index.ts`**:
- Righe 291-315: sostituire il blocco singolo `budget_warning` con 3 check progressivi su `targetBudget`
- Riga 258: aggiungere i nuovi tipi nell'array dei tipi notifica per il dedup check

