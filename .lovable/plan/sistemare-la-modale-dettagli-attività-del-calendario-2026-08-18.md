# Sistemare la modale "Dettagli Attività" del calendario

La modale che si apre cliccando su una task/attività pianificata si allarga oltre la sua larghezza prevista e il contenuto esce dai bordi: il titolo lungo della task nel select non viene troncato, quindi il campo (e con lui l'intera modale) si dilata.

## Cosa cambia (solo presentazione)

1. **Larghezza e altezza controllate**: la modale resta a larghezza fissa (max ~28rem), non si allarga mai in base al contenuto, e diventa scrollabile in verticale quando i campi superano l'altezza della finestra.
2. **Testi troncati**: i valori selezionati di Progetto, Attività e Task vengono troncati con puntini su una sola riga; i badge (categoria, priorità) restano visibili accanto senza essere schiacciati. Stessa cura nelle liste a tendina.
3. **Campo Data coerente**: il campo data usa lo stesso stile degli altri controlli, con larghezza piena e senza il picker nativo disallineato.
4. **Footer allineato**: "Elimina" a sinistra, "Annulla"/"Salva" a destra, sulla stessa linea di base e con spaziatura coerente anche in modalità duplica (dove "Elimina" non c'è).

## Note tecniche

- File principale: `src/pages/Calendar.tsx`, blocco `Dialog` "Dettagli Attività" (righe ~1739-1865).
- `DialogContent`: aggiungere `w-[calc(100vw-2rem)] sm:w-full max-w-md max-h-[85vh] overflow-y-auto` e togliere la crescita del contenuto (`min-w-0` sui wrapper dei campi).
- `SelectTrigger`: aggiungere `w-full min-w-0` e sul contenuto interno `truncate` / `flex-1 min-w-0` così i badge non vengono compressi.
- Applicare la stessa gestione del troncamento in `src/components/calendar/ActivityTaskSelect.tsx` (titolo task lungo + badge priorità).
- Footer: `flex flex-wrap items-center justify-between gap-2 pt-4 border-t`, con `ml-auto` sul gruppo destro quando "Elimina" è assente.
- Nessuna modifica alla logica di salvataggio, ai conflitti di slot o alle mutation.
