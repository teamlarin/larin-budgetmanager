

## Rimuovere "Importa Timesheet" e "Elimina Ore Importate" dalle Impostazioni Generali

### Modifiche

**1. `src/components/GlobalSettingsManagement.tsx`**
- Rimuovere l'import di `TimesheetImport` (riga 13) e `Trash2` dall'import icons (riga 10)
- Rimuovere l'interface `ImportedHoursPreview` (righe 49-55)
- Rimuovere gli state: `isDeletingImportedHours`, `deletedHoursCount`, `importedHoursPreview`, `isLoadingPreview`, `showPreview` (righe 64-68)
- Rimuovere le funzioni `handleLoadPreview` (righe 317-401) e `handleDeleteImportedHours` (righe 404-456)
- Rimuovere il blocco JSX "Importa Timesheet" (righe 656-657) e "Elimina Ore Importate" (righe 659-776)
- Rimuovere anche l'import di `AlertDialog` e componenti correlati (righe 15-25) se non usati altrove nel file

**2. Nessun file eliminato**
- `TimesheetImport.tsx` resta perche' e' ancora usato in `ProjectTimesheet.tsx` per l'import nel singolo progetto

