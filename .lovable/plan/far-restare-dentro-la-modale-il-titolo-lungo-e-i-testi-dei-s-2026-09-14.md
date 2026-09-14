# Far restare dentro la modale il titolo lungo e i testi dei select

La modale "Collega a Progetto/Attività" (`GoogleCalendarEvent.tsx`) si allarga o il contenuto esce a destra quando il titolo dell'evento Google è lungo o contiene un URL, e quando i nomi di progetto/attività nei select superano la larghezza.

## Cosa cambia (solo presentazione)

1. **Larghezza fissa della modale**: aggiungere `w-[calc(100vw-2rem)] sm:w-full max-w-md` al `DialogContent` in modo che non cresca mai in base al contenuto.
2. **Titolo e location a capo**: nel box in alto sostituire `truncate` e la combinazione `line-clamp-2 break-all` con `whitespace-normal break-words` (o `break-all` solo per URL, ma senza `truncate`), e aggiungere `overflow-hidden` al contenitore così il testo non sfonda.
3. **Select trigger multilinea**: sui `SelectTrigger` di Progetto e Attività aggiungere `h-auto min-h-9 whitespace-normal break-words text-left` e assicurarsi che il `SelectValue`/`span` interno possa andare a capo.
4. **Select item multilinea**: sui `SelectItem` di Progetto e Attività aggiungere `h-auto min-h-9` e classi di wrapping (`whitespace-normal break-words`), mantenendo i badge a fianco con `shrink-0`.
5. **Nessun overflow orizzontale**: aggiungere `overflow-x-hidden` al `DialogContent` come sicurezza.

## File coinvolto

- `src/components/GoogleCalendarEvent.tsx` — modale, box titolo/location, select progetto/attività.

## Note tecniche

- I `SelectTrigger` e `SelectItem` di shadcn/ui hanno altezza fissa (`h-9`): va sovrascritta con `h-auto min-h-9`.
- I badge categoria devono rimanere visibili e non compressi (`shrink-0`).
- Non si tocca logica di conversione, salvataggio o filtri.
