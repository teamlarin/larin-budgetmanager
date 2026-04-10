

## Rimuovere duplicazione sezione servizi nel budget

### Problema
Ci sono due box "Servizi collegati" nella pagina budget:
1. `BudgetLinkedServices` in `ProjectBudget.tsx` (riga 641) — per aggiungere/rimuovere servizi
2. Sezione "Servizi Collegati" dentro `BudgetManager.tsx` (riga 1077+) — per editare dettagli servizi

Entrambi leggono da `budget_services`, causando duplicazione.

### Intervento

Rimuovere la sezione servizi da `BudgetManager.tsx` (righe 1077-1170 circa) e mantenere solo il componente `BudgetLinkedServices` in `ProjectBudget.tsx`, che già gestisce aggiunta/rimozione. La logica interna di `BudgetManager` per fetch servizi (`services`, `editingServices`, ecc.) resta necessaria per la generazione preventivo, ma la UI della tabella servizi viene eliminata.

### File modificati
- **`src/components/BudgetManager.tsx`**: rimuovere il blocco JSX "Services Section" (~righe 1077-1170). Mantenere le query e la logica di generazione preventivo invariate.

