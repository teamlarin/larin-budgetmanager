# Perché i dati HR non si vedono nella scheda persona

Ho verificato: ci sono **due cause distinte**, entrambe confermate.

## 1. Errore di permessi sulle nuove colonne del profilo

Nella console appare `permission denied for table profiles`. La tabella `profiles` ha permessi di lettura **colonna per colonna** (eredità dell'hardening di sicurezza): sono autorizzate solo id, email, nomi, avatar, area, level, ecc. Le colonne nuove `bio`, `skills`, `interests`, `languages` **non hanno il permesso di lettura**, quindi l'intera query della scheda persona va in errore e la card resta vuota.

## 2. Nessuna scheda HR è collegata a un utente

Nella tabella HR ci sono **46 dipendenti, ma 0 hanno il collegamento all'utente TimeTrap** (`profile_id` vuoto per tutti). La scheda persona cerca i dati HR proprio tramite quel collegamento: senza abbinamento non può mostrare data di nascita, residenza e inizio contratto per nessuno.

## Cosa faccio

**Migrazione database**
- Concedo la lettura delle colonne `bio`, `skills`, `interests`, `languages` di `profiles` agli utenti autenticati (e la scrittura su queste colonne, così il salvataggio resta garantito).
- Nessun'altra colonna sensibile viene esposta: RAL, tariffe e dati economici restano riservati come oggi.

**Collegamento HR → utente**
- Abbinamento automatico (una tantum, nella stessa migrazione) delle schede HR ai profili quando nome+cognome corrispondono in modo univoco a un utente approvato, oppure quando l'email coincide. I casi ambigui restano da collegare a mano.
- In `HrEmployeeDialog` (Impostazioni → HR, per admin/finance) rendo più visibile il campo "Utente TimeTrap collegato" con avviso quando manca, così le schede non abbinate si completano facilmente.

**UI scheda persona**
- Messaggio più chiaro quando la scheda HR non è collegata, distinguendo "nessun collegamento HR" da "campi HR vuoti".

## Note tecniche
- `GRANT SELECT/UPDATE (bio, skills, interests, languages) ON public.profiles TO authenticated`.
- La funzione `get_profiles_hr_public` resta invariata: già filtra i campi non sensibili.
- Il match automatico usa un `UPDATE ... FROM` con confronto case-insensitive su email e su `nome`/`cognome`, applicato solo dove esiste una corrispondenza unica.
