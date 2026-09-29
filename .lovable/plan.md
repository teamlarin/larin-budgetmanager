# Descrizione modello leggibile e niente scorrimento orizzontale

## Problema
1. L'icona (i) sta dentro la voce dell'elenco modelli: il menu a tendina intercetta il clic e seleziona il modello invece di aprire il riquadro.
2. La finestra "Nuovo Elemento Budget" scorre in orizzontale quando nomi di modello o attività sono lunghi.

## Cosa cambia
1. **Tolgo la (i) dall'elenco a tendina.** Dopo aver scelto un modello compare un riquadro "Descrizione del modello" sotto il selettore, con ore, costo e descrizione completa: chiuso di default, si apre con un clic e scorre in verticale se il testo è lungo.
2. **Nell'elenco dei modelli** i nomi lunghi vanno a capo invece di allargare la finestra.
3. **Niente scorrimento orizzontale:** la finestra resta nella sua larghezza; i nomi delle attività nella lista e nel riepilogo vanno a capo invece di essere tagliati o di allargare il riquadro.

## Dettagli tecnici
- `src/components/BudgetItemForm.tsx`: rimuovere il `Popover` dal `SelectItem` (righe 502-531); aggiungere sotto il `Select` un `Collapsible` visibile solo con `selectedTemplate`, contenuto `max-h-[40vh] overflow-y-auto whitespace-pre-wrap break-words`.
- `SelectItem` e `SelectValue` con `whitespace-normal break-words`, trigger `h-auto min-h-9 text-left`, `SelectContent` con larghezza massima pari al trigger.
- `DialogContent`: aggiungere `overflow-x-hidden`; righe attività/riepilogo con `min-w-0 break-words` al posto di `truncate`.
- Solo presentazione, nessuna modifica a dati o logica.
