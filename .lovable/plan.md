

## Rimozione sezione "Ricalcolo Progresso Progetti Pack"

Rimuovere l'intera sezione dalla pagina Impostazioni > Generali, dato che non vengono più fatti import manuali e il ricalcolo non è più necessario.

### Modifiche

**`src/components/GlobalSettingsManagement.tsx`**:
- Rimuovere il blocco Card "Ricalcolo Progresso Progetti Pack" (righe 324-394)
- Rimuovere l'interfaccia `PackProgressResult` (righe 14-21)
- Rimuovere lo state `recalculateResults` e `isRecalculating`
- Rimuovere la funzione `handleRecalculatePackProgress`
- Rimuovere gli import non più usati: `RefreshCw`, `Package`

La funzione SQL `recalculate_all_pack_projects_progress` nel database resta intatta (non fa danni e potrebbe servire in futuro via SQL diretto).

