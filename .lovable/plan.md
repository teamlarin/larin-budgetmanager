# Fix: scroll del menu assegnatari nella creazione task

## Problema
Nella finestra "Nuova task" il menu a tendina degli assegnatari non si può scorrere: con molti utenti, quelli in fondo alla lista sono irraggiungibili.

## Causa (verificata)
In `src/components/project-tasks/ProjectTaskFormSheet.tsx` il menu assegnatari è un `Popover` (riga 324) aperto dentro uno `Sheet` modale (riga 210). Il contenuto del popover viene renderizzato in un portal fuori dallo Sheet, e il blocco scroll del pannello modale intercetta gli eventi rotellina/touch, impedendo lo scroll della lista (`max-h-72 overflow-y-auto` è già presente ma non riceve gli eventi).

## Intervento
1. Aggiungere la prop `modal` al `Popover` degli assegnatari in `ProjectTaskFormSheet.tsx` (`<Popover modal>`), così il popover gestisce correttamente focus e scroll dentro lo Sheet modale.
2. Applicare lo stesso fix agli altri due `Popover` della stessa finestra (date picker, righe ~372 e ~399) per coerenza ed evitare lo stesso problema.
3. Verificare a video che la lista assegnatari scorra e che la selezione multipla continui a funzionare.

## Dettagli tecnici
- Nessuna modifica a database o logica: solo props sui componenti UI esistenti.
- `Popover modal` è supportato nativamente da Radix UI già in uso nel progetto.
