

## Aggiungere colonna "Saldo" alla tabella Riepilogo Ore Team

### Modifica

**File: `src/components/dashboards/UserHoursSummary.tsx`**

1. Aggiungere una colonna **"Saldo"** tra "Previste" e "Progresso" nella tabella
2. Il valore = `confirmedHours - expectedHours` (positivo = ore in più, negativo = ore mancanti)
3. Formattazione: verde con segno `+` se positivo, rosso con segno `-` se negativo, grigio se zero
4. Aggiungere il totale saldo anche nelle stat cards in alto
5. Aggiungere l'intestazione `<TableHead>Saldo</TableHead>`

