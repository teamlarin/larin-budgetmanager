# Ordine nella gestione password utente

## Situazione attuale
- La maggior parte degli utenti accede con Google (@larin.it).
- Nel profilo utente **non esiste** alcuna sezione per cambiare la password: c'è solo la card "Account Google".
- Esistono già: pagina pubblica `/forgot-password` (invio link via email), pagina `/reset-password` (imposta nuova password, con indicatore di robustezza) e la voce admin "Reimposta password" in Utenti, che invia una mail di reset tramite la funzione `reset-user-password`.

## Serve il reset via email?
Sì, va tenuto: è l'unica strada per chi ha perso la password e **non** riesce ad entrare (non può quindi usare il profilo). Serve anche all'admin per sbloccare un utente. Quello che manca è il cambio password **da dentro l'app**, per gli utenti che accedono già con email/password.

## Cosa faremo

### 1. Nuova card "Sicurezza e accesso" nel profilo
Nel tab Impostazioni del profilo, sotto "Account Google":
- Mostra chiaramente **come accede l'utente**: "Accesso con Google" oppure "Accesso con email e password" (rilevato dai metodi di autenticazione collegati all'account).
- **Se accede solo con Google**: nessun campo password, solo un messaggio che spiega che la password è gestita da Google e che non serve impostarla. Opzione secondaria "Imposta una password" per chi vuole anche l'accesso con email (facoltativo, vedi domanda sotto).
- **Se ha email/password**: form "Cambia password" con nuova password + conferma, stesse regole di robustezza già usate (min 8 caratteri, maiuscola, minuscola, numero) e l'indicatore di sicurezza esistente. Al salvataggio la password viene aggiornata e compare un messaggio di conferma.
- Link "Hai dimenticato la password attuale?" che porta al flusso email esistente.

### 2. Chiarezza sul login
Nella pagina di accesso, "Continua con Google" viene messo in evidenza come metodo principale, con email/password come alternativa (nessuna rimozione di funzionalità).

### 3. Reset via email: manteniamo, ma più chiaro
- `/forgot-password`: aggiunta una nota che gli account @larin.it accedono normalmente con Google e non hanno bisogno del reset.
- La voce admin "Reimposta password" resta invariata, con testo che chiarisce che serve solo per utenti non-Google.

## Note tecniche
- Rilevamento metodo di accesso: `supabase.auth.getUser()` → `user.identities` (provider `google` vs `email`).
- Cambio password: `supabase.auth.updateUser({ password })` sulla sessione attiva.
- Riuso di `PasswordStrengthIndicator` e dello schema zod già presente in `ResetPassword.tsx` (estratto in un piccolo modulo condiviso).
- Nessuna modifica al database, alle policy o alle edge function.
