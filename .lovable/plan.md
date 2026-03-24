

## Sezione "Banca Ore" nella pagina Profilo

### Obiettivo
Aggiungere una card nella pagina Profilo che mostri all'utente loggato il proprio riepilogo ore: dettaglio mese per mese da gennaio al mese corrente, con saldo mensile, saldo anno, riporto anno precedente e rettifiche — tutto in sola lettura.

### Nuovo componente: `src/components/ProfileHoursBank.tsx`

Componente autonomo che:
1. Recupera l'`userId` dall'utente autenticato
2. Esegue le stesse query usate in `UserHoursSummary`, ma filtrate per il singolo utente:
   - `profiles` per dati contratto e target produttività
   - `user_contract_periods` per i periodi contrattuali
   - `activity_time_tracking` YTD con raggruppamento mensile
   - `user_hours_adjustments` per le rettifiche dell'anno
   - `user_hours_carryover` per il riporto anno precedente
   - `app_settings` closure_days per i giorni di chiusura
3. Riusa le funzioni di calcolo (Easter, closure dates, working days, expected hours) — estratte o duplicate dal file `UserHoursSummary`

**UI della card**:
- Header: "Banca Ore" con anno corrente
- Summary in alto: Saldo Anno (con riporto incluso), Ore Confermate YTD, Ore Previste YTD, Riporto
- Tabella mese per mese (da gennaio al mese corrente):
  - Colonne: Mese | Ore Confermate | Rettifica | Ore Previste | Saldo Mese
- Riga totale in fondo con YTD + carryover = Saldo Anno finale
- Tutto in sola lettura (nessun pulsante edit)

### Modifica: `src/pages/Profile.tsx`

Importare e inserire `<ProfileHoursBank />` come card dopo la sezione "Informazioni Personali" e prima di "Account Google".

### File coinvolti
- **Nuovo**: `src/components/ProfileHoursBank.tsx`
- **Modificato**: `src/pages/Profile.tsx` — aggiunta import e rendering del componente

### Note
- Le funzioni di utilità (Easter, closure dates, working days) verranno duplicate nel nuovo componente per evitare refactoring complesso di `UserHoursSummary`. Sono ~50 righe di logica pura.
- Le query RLS esistenti permettono già a ogni utente autenticato di leggere i propri dati (`activity_time_tracking`, `user_hours_adjustments`, `user_hours_carryover`).
- Nessuna modifica al database necessaria.

