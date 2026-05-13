## Piano

1. **Rendere evidente quale versione stai usando**
   - Aggiungo un `debug_version` alla funzione `jethr-list-employees` e lo mostro nel dialog “Mappa utenti”.
   - Così capiamo subito se il browser sta usando la funzione/frontend aggiornati o una versione precedente.

2. **Mostrare sempre il fallback sulle assenze**
   - Se `/employees/` restituisce 0, il dialog mostrerà sempre:
     - conteggio record letti da `/presence-absence-requests/`
     - primo record assenza ricevuto
     - chiavi/campi candidati trovati per identificare il dipendente
   - In questo momento il testo che riporti non contiene la riga “Fallback da…”, quindi sembra che tu stia ancora vedendo una versione non aggiornata o che la risposta non includa i nuovi campi.

3. **Estrarre dipendenti anche da strutture Jethr diverse**
   - Rendo l’estrazione più tollerante con una scansione ricorsiva dei record assenza, cercando campi come `employee`, `user`, `person`, `owner`, `applicant`, `created_by`, `resource`, ma anche ID scalari tipo `employee_id`, `person_id`, `user_id`, `employeeUuid`, `employeeCode`, `external_id`, `pk`.
   - Se trova ID validi, costruisce la lista dipendenti per permetterti di mappare gli utenti anche senza endpoint `/employees/`.

4. **Fallback di debug utile se non trova ancora dipendenti**
   - Se non riesce comunque a costruire dipendenti, la funzione restituirà un elenco di “percorsi candidati” dentro il JSON, ad esempio `request.employee.id` o `created_by.pk`, così possiamo adattare l’estrazione al payload reale senza andare a tentativi.

5. **Validazione dopo modifica**
   - Deploy della funzione `jethr-list-employees`.
   - Chiamata diretta alla funzione e controllo log per verificare:
     - `/employees/` = 0
     - `/presence-absence-requests/` > 0
     - dipendenti estratti > 0 oppure campi candidati visibili nel dialog.