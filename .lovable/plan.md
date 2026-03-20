

## Fix calcolo ore previste: usare giorni lavorativi effettivi

### Modifica

**File: `src/components/dashboards/UserHoursSummary.tsx`**, riga 209

Cambiare il calcolo per contratti mensili da:
```
case 'monthly': return (contractHours / 22) * workingDays;
```
a:
```
case 'monthly': return contractHours;
```

Le ore contratto mensili rappresentano già il totale atteso per il mese. Non serve dividere per 22 e rimoltiplicare per i giorni effettivi — il valore contrattuale è già quello corretto.

