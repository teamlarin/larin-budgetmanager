# Correzione apertura cartelle Google Drive

## Obiettivo
Aprire la cartella Drive collegata a progetto o cliente in una vera nuova scheda, senza tentare di caricare Google Drive nel frame dell’app.

## Intervento
- Sostituire il click JavaScript generato da `openExternal` con un collegamento HTML nativo `<a>` tramite il componente `Button` con `asChild`.
- Impostare direttamente sul link `href`, `target="_blank"` e `rel="noopener noreferrer"`, così la navigazione resta associata al gesto dell’utente e viene gestita dal browser come pagina top-level.
- Applicare la stessa correzione sia alla cartella Drive della scheda progetto sia alla cartella Drive nella gestione clienti, evitando comportamenti diversi tra i due punti.
- Rimuovere l’helper dedicato se non rimangono altri utilizzi.

## Verifica
- Controllare che il markup renderizzato contenga un link Drive reale con destinazione `https://drive.google.com/drive/folders/{id}` e `target="_blank"`.
- Verificare build e typecheck.
- Testare il click nella preview per confermare la creazione di una pagina separata; per la prova autenticata definitiva sul sito pubblicato sarà necessario pubblicare l’aggiornamento frontend.
