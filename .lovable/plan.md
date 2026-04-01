

## Aggiungere colonna "Ore recuperate" (banca ore) al Riepilogo Ore Team

### Cosa cambia
Aggiungere una nuova colonna **"Recuperate"** nella tabella del riepilogo ore team che mostra le ore del mese associate all'attività "banca ore". Questo dato è già calcolato (`monthBancaOre`) ma non visualizzato in tabella.

### Modifiche in `src/components/dashboards/UserHoursSummary.tsx`

1. **Header tabella (~riga 833):** Aggiungere `<TableHead className="text-right">Recuperate</TableHead>` dopo la colonna "Confermate", solo in modalità non-compact.

2. **Riga utente (~riga 893):** Dopo la cella "Confermate" (con adjustment), aggiungere una nuova `<TableCell>` che mostra `user.monthBancaOre` — con trattino "—" se zero, altrimenti il valore formattato.

3. **Nessuna modifica alla logica di calcolo** — il dato `monthBancaOre` è già disponibile nell'oggetto utente.

