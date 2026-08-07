# Clienti mancanti nella lista (limite 1.000 righe)

## Diagnosi confermata

"Meccanostampi s.r.l." esiste nel database (creato oggi, 07/08/2026 09:27) insieme a un duplicato "Meccanostampi SRL". Non compare perché la lista clienti carica i clienti **senza paginazione**: Supabase restituisce al massimo 1.000 righe per query, mentre in anagrafica ci sono **1.813 clienti**. Ordinati per nome, "Meccanostampi s.r.l." è alla posizione **1089**, quindi cade fuori dal blocco caricato — insieme a tutti i clienti dalla "M" in poi (circa 800 nomi invisibili).

La stessa mancanza di paginazione riguarda anche gli altri punti dove si caricano i clienti (selettore cliente nei progetti/attività, liste in preventivi, canvas progetto, import): anche lì i clienti oltre il 1.000° non sono selezionabili.

## Cosa cambia per l'utente

- Nella sezione Clienti compaiono tutti i 1.813 clienti, ricerca e filtri inclusi.
- Nei selettori cliente (progetti, attività manuali, preventivi, timesheet, canvas) diventano selezionabili anche i clienti dalla M alla Z.
- Nessuna modifica a dati, permessi o layout.

## Dettagli tecnici

- Aggiungere un helper condiviso (es. `src/lib/fetchAllClients.ts`) che pagina con `.range(from, from + 999)` in loop finché il batch restituito è pieno, con `order('name')` stabile.
- Sostituire le query non paginate con l'helper in: `src/components/ClientManagement.tsx` (`fetchClients`), `src/components/ClientSelector.tsx`, `src/pages/Index.tsx`, `src/pages/ProjectCanvas.tsx`, `src/pages/ProjectBudget.tsx`, `src/pages/Calendar.tsx`, `src/components/CreateProjectDialog.tsx`, `src/components/CreateManualProjectDialog.tsx`, `src/components/CreateManualActivityDialog.tsx`, `src/components/ProjectActivitiesManager.tsx`, `src/components/ProjectTimesheet.tsx`, `src/components/ContactManagement.tsx`, `src/components/ProjectCard.tsx`, `src/components/QuoteDetail.tsx` / `QuoteStatusSelector.tsx`, `src/components/ClientImport.tsx` e `ContactImport.tsx` (controllo duplicati) e `src/components/ProjectImport.tsx`.
- Mantenere le colonne già selezionate in ciascun punto (nessun `select('*')` nuovo).
- Verifica finale: contare i clienti resi in lista e cercare "Meccanostampi" nella UI.

## Nota a parte

Esistono due schede quasi identiche: "Meccanostampi s.r.l." e "Meccanostampi SRL". Dopo il fix si possono unire con la funzione "Unisci clienti" già presente — fuori scopo se non richiesto.
