

## Problema

L'utente external non vede il calendario degli altri utenti e il pulsante "Confronta" deve essere disabilitato.

### Cause identificate

1. **Race condition nella query `allUsers`**: La query key è `['all-users-for-calendar', 'external']` ma non include `externalAccessibleUserIds` come dipendenza. Quando la prima query (`external_visible_users`) si completa, la seconda query non si riesegue perché la key non cambia.
2. **"Confronta" visibile**: Il pulsante è mostrato per tutti i `CALENDAR_VIEWER_ROLES`, incluso `external`.

### Soluzione

**`src/pages/Calendar.tsx`** (2 modifiche):
- Aggiungere `externalAccessibleUserIds` alla query key di `allUsers` (riga 324) per forzare il refetch quando i dati di visibilità vengono caricati
- Passare `isExternalUser` al `CalendarHeader`

**`src/components/calendar/CalendarHeader.tsx`** (1 modifica):
- Aggiungere prop `isExternalUser` e nascondere il pulsante "Confronta" quando `isExternalUser === true`

