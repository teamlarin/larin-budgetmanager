# Far visualizzare il testo completo nelle select della modale Dettagli Attività

La modale "Dettagli Attività" ha una larghezza fissa (`max-w-md`) e scroll verticale, ma i selettori Progetto, Attività e Task troncano il testo su una sola riga. L’obiettivo è mostrare il testo completo andando a capo, senza far traboccare la finestra in larghezza.

## Cosa cambia

1. **Rimuovere il troncamento e abilitare il wrapping** nei trigger dei selettori della modale:
   - Sostituire `truncate` con `whitespace-normal` e `break-words`.
   - Aggiungere `h-auto min-h-9` ai `SelectTrigger` e ai singoli `SelectItem` per far espandere verticalmente la riga.

2. **Applicare lo stesso trattamento in `ActivityTaskSelect.tsx`**:
   - Il trigger della select task deve andare a capo.
   - Le opzioni della select task devono visualizzare il titolo completo su più righe, mantenendo il badge di priorità accanto.

3. **Mantenere i vincoli di layout esistenti**:
   - Lasciare `max-w-md`, `max-h-[85vh]` e `overflow-y-auto` sul `DialogContent`.
   - Garantire che `overflow-x-hidden` resti attivo per evitare scroll orizzontale.

4. **Non toccare logica o dati**: nessuna modifica a salvataggio, conflitti, mutation, database.

## File coinvolti

- `src/pages/Calendar.tsx` — selettori Progetto, Attività e stile della modale Dettagli Attività (righe ~1738-1869).
- `src/components/calendar/ActivityTaskSelect.tsx` — selettore Task e opzioni.

## Note tecniche

- I `SelectTrigger` di shadcn/ui hanno altezza fissa (`h-9`): va sovrascritta con `h-auto min-h-9`.
- Gli `SelectItem` di shadcn/ui hanno anch’essi altezza fissa: va gestita l’espansione per opzioni multilinea.
- I `Badge` (categoria / priorità) devono rimanere visibili e non essere compressi (`shrink-0`).
- Il testo nel trigger deve restare allineato a sinistra (`text-left`).
