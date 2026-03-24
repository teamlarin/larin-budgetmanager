

## Aggiungere tipo contratto "Consuntivo"

### Problema
Alcuni utenti hanno un contratto "a consuntivo" (time & materials): non hanno ore previste fisse, registrano solo le ore effettivamente lavorate. Attualmente non esiste questo tipo nella selezione e i riepiloghi ore non lo gestiscono.

### Soluzione

#### 1. Database — Nuova migrazione
Aggiungere il valore `consuntivo` all'enum `contract_type`:
```sql
ALTER TYPE contract_type ADD VALUE 'consuntivo';
```

#### 2. UI Gestione Utenti — `UserManagement.tsx`
- Aggiornare `ContractType` con `"consuntivo"`
- Aggiungere `<SelectItem value="consuntivo">Consuntivo</SelectItem>` nei 2 form (creazione e modifica utente)
- Quando `contract_type = "consuntivo"`, nascondere o disabilitare i campi "Ore da contratto" e "Periodo ore" (non applicabili)

#### 3. UI Periodi contrattuali — `UserContractPeriodsDialog.tsx`
- Stesse modifiche: aggiungere opzione "Consuntivo" e nascondere campi ore/periodo se selezionato

#### 4. Riepilogo Ore Team — `UserHoursSummary.tsx`
- `getContractTypeLabel`: aggiungere `'consuntivo': 'Consuntivo'`
- `calculateExpectedHoursForUser`: se il contract_type (dal profilo o dal periodo contrattuale) e' `consuntivo`, restituire `0` ore previste
- Nella tabella, per utenti consuntivo:
  - Colonne "Previste", "Saldo", "Saldo Anno", "Progresso" mostreranno "—" o saranno azzerate, dato che non hanno target orario
  - La colonna "Confermate" continua a funzionare normalmente
- Nel filtro contratto, aggiungere opzione "Consuntivo" oltre a Tutti/Dipendenti/Freelance

#### 5. Banca Ore profilo — `ProfileHoursBank.tsx`
- Stessa logica: se il contract_type è `consuntivo`, le ore previste sono 0
- Mostrare un messaggio tipo "Contratto a consuntivo — nessun target orario" al posto della tabella dettagliata, oppure mostrare solo le ore confermate senza colonna previste

#### 6. UserMonthlyDetail — `UserMonthlyDetail.tsx`
- Se l'utente è a consuntivo, la colonna "Previste" mostra "—"

### File coinvolti
- Nuova migrazione SQL (alter enum)
- `src/components/UserManagement.tsx`
- `src/components/UserContractPeriodsDialog.tsx`
- `src/components/dashboards/UserHoursSummary.tsx`
- `src/components/dashboards/UserMonthlyDetail.tsx`
- `src/components/ProfileHoursBank.tsx`

