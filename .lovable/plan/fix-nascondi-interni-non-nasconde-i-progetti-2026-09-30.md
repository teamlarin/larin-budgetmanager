# Fix: "Nascondi interni" non nasconde i progetti

## Causa
In `src/components/dashboards/LeaderControlView.tsx` (riga 60) la lista chiama `useLeaderProjectsControl(userId)` senza passare `hideInternal`: l'interruttore aggiorna solo il badge della tab, non la lista.

## Modifica
- Riga 60: `useLeaderProjectsControl(userId, hideInternal)`.
- Nessun'altra modifica.

## Verifica
- Build OK; attivando l'interruttore i progetti con area `interno` spariscono da lista, KPI e badge.
