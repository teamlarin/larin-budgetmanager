# Profilo utente più ricco (stile scheda HR)

Trasformiamo la pagina Profilo in una scheda persona completa: dati anagrafici/HR in sola lettura più sezioni personali modificabili (bio, skills, interessi, lingue), visibili a tutti gli utenti approvati.

## Cosa vede l'utente

Nuova card **"Scheda persona"** nel profilo, con due blocchi:

1. **Dati HR (sola lettura, badge "Da HR")**
   - Data di nascita
   - Indirizzo di residenza
   - Inizio contratto / collaborazione
   - Ruolo e team già presenti in HR
   - Se non ci sono dati HR collegati: messaggio "Dati non ancora disponibili, contatta HR"

2. **Sezioni personali (modificabili dall'utente)**
   - **Bio breve**: testo libero multilinea (line break preservati)
   - **Skills**: tag aggiungibili/rimovibili
   - **Interessi**: tag aggiungibili/rimovibili
   - **Lingue**: coppie lingua + livello (Native, C2…A1) con aggiunta/rimozione righe

Layout a due colonne su desktop, una colonna su mobile, coerente con l'attuale design system (nessun colore hardcoded).

## Visibilità

Tutti gli utenti approvati possono vedere bio, skills, interessi, lingue e i tre campi HR (nascita, residenza, inizio contratto). RAL, fringe, orario e altri dati economici di `hr_employees` restano riservati ad admin/finance come oggi.

## Note importanti

- **Nessuna sincronizzazione API con JetHr**: i campi HR arrivano dalla tabella HR già presente in TimeTrap (`hr_employees`), popolata da admin/finance in Impostazioni. L'integrazione API JetHr è stata rimossa in precedenza; se la vuoi ripristinare la trattiamo come lavoro separato.
- L'indirizzo di residenza oggi non esiste in nessuna tabella: lo aggiungiamo alla scheda HR (compilabile da admin/finance).

## Dettagli tecnici

**Migrazione database**
- `profiles`: nuove colonne `bio text`, `skills text[] default '{}'`, `interests text[] default '{}'`, `languages jsonb default '[]'` (array di `{language, level}`).
- `hr_employees`: nuova colonna `indirizzo_residenza text`.
- RLS: policy di SELECT su `profiles` già consente lettura agli utenti approvati; le nuove colonne non sono sensibili.
- Nuova funzione `public.get_profiles_hr_public(_user_ids uuid[])` `SECURITY DEFINER` che restituisce solo `profile_id, data_nascita, indirizzo_residenza, data_inizio_collaborazione, data_inizio, sesso, job_title, team` per gli utenti approvati (esclude `external`), senza esporre le colonne economiche. `GRANT EXECUTE` solo a `authenticated`, revoca da `PUBLIC`/`anon`.

**Frontend**
- `src/pages/Profile.tsx`: nuova card "Scheda persona" con blocco HR in sola lettura (via RPC) e form per bio/skills/interessi/lingue salvati su `profiles`.
- Nuovi componenti riutilizzabili: `src/components/profile/TagListEditor.tsx` (skills/interessi) e `src/components/profile/LanguagesEditor.tsx`.
- `src/components/dashboards/HrEmployeeDialog.tsx`: aggiunta del campo indirizzo di residenza per admin/finance.
- Date formattate con `date-fns` (`dd.MM.yyyy`), niente `toISOString()`.
