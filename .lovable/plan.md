

## Riepilogo Ore Team compatto per il Team Leader

### Obiettivo
Nella dashboard team leader, tab "Team", il widget `UserHoursSummary` mostra troppe informazioni. Il team leader ha bisogno solo del **saldo anno per utente**, aggiornato al mese precedente, con alcune informazioni aggiuntive utili.

### Approccio
Aggiungere una prop `compactMode?: boolean` a `UserHoursSummary`. Quando attiva:

**Dati**:
- Mese inizializzato al **mese precedente** (non corrente)
- Stessi calcoli YTD gia presenti

**UI semplificata**:
- Stat card: mostrare solo **Saldo Anno totale** e **Produttivita Billable media**
- Tabella con sole colonne: **Utente**, **Tipo contratto**, **Saldo Anno**, **Prod. Billable**
- Nascondere: filtro contratto, count utenti, export, colonne confermate/previste/saldo mese/riporto/progresso
- Righe non espandibili
- Navigazione mesi mantenuta (per consultare storico)
- Subtitle: "Aggiornato a {mese precedente}"

**Informazioni aggiuntive utili per il team leader**:
- **Produttivita Billable** per utente: gia calcolata, la manteniamo nella tabella compatta per dare visibilita su chi produce ore fatturabili
- **Indicatore visivo saldo**: colori rosso/verde sul saldo anno per evidenziare situazioni critiche

### Modifiche

**`src/components/dashboards/UserHoursSummary.tsx`**:
- Aggiungere prop `compactMode?: boolean`
- Se `compactMode`, inizializzare `selectedMonth` a `startOfMonth(subMonths(new Date(), 1))`
- Nel render, condizionare la visibilita di stat card, colonne tabella, filtri, expansion e export in base a `compactMode`

**`src/pages/Dashboard.tsx`** (~riga 1739):
- Passare `compactMode` al componente:
  ```tsx
  <UserHoursSummary compactMode />
  ```

### File modificati
- `src/components/dashboards/UserHoursSummary.tsx`
- `src/pages/Dashboard.tsx`

