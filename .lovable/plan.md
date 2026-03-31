

## Fix: scadenza non si aggiorna + aggiunta 180 giorni

### Problemi identificati

1. **La query non seleziona `timesheet_token_expiry_days`** (riga 171): il campo non viene mai letto dal DB, quindi il badge usa sempre il default 30.
2. **Il badge legge da `projectData`**, non da `shareDurationDays`: cambiare il select non aggiorna il badge finché non si rigenera il link.
3. **Manca l'opzione 180 giorni** nel selettore.

### Modifiche — `src/components/ProjectTimesheet.tsx`

| Riga | Cosa |
|------|------|
| 171 | Aggiungere `timesheet_token_expiry_days` alla select della query |
| 920-921 | Aggiungere `<SelectItem value="180">180 giorni</SelectItem>` |
| 964 | Il badge deve usare `shareDurationDays` (stato locale) invece di `(projectData as any).timesheet_token_expiry_days` quando l'utente ha cambiato il selettore, e il valore dal DB come default iniziale |

### Dettagli tecnici

- **Query** (riga 171): `select('timesheet_share_token, timesheet_token_created_at, name, timesheet_token_expiry_days')`
- **Inizializzazione** `shareDurationDays`: aggiungere un `useEffect` che sincronizza `shareDurationDays` dal valore DB quando `projectData` cambia
- **Badge** (riga 964): usare `shareDurationDays` al posto di `(projectData as any).timesheet_token_expiry_days || 30`
- **Select**: aggiungere opzione 180 giorni

