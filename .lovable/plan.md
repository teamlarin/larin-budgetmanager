# Auto-creazione cartella Drive progetto

## Contesto

Oggi la cartella Drive del progetto viene creata in modo incoerente:

| Flusso | Cartella Drive progetto |
|---|---|
| `CreateProjectDialog` (nuovo budget) | Creata sul budget (`N/YYYY - nome`) dentro cartella cliente |
| `QuoteStatusSelector` (approvazione preventivo da lista) | Creata nuova per il progetto (`YYYY_quote# - cliente - nome`) |
| `QuoteDetail` (approvazione preventivo da dettaglio) | Mancante — riusa solo `drive_folder_id` del budget |
| `CreateManualProjectDialog` (progetto manuale) | Mancante |

L'utente vuole che ogni progetto "in partenza" abbia la propria cartella dentro la cartella cliente.

## Modifiche

### 1. `src/pages/QuoteDetail.tsx` — approvazione preventivo
Dopo l'`insert` del nuovo progetto (riga ~388), prima del `navigate`, aggiungere lo stesso blocco già presente in `QuoteStatusSelector`:
- recupera `clients.drive_folder_id` e `clients.name`
- recupera `quotes.quote_number`
- costruisce `folderName = ${year}_${quote_number} - ${client.name} - ${budget.name}`
- chiama `supabase.functions.invoke('google-drive-folders', { action: 'create-folder', parentFolderId: client.drive_folder_id, folderName })`
- aggiorna il progetto con `drive_folder_id` / `drive_folder_name` restituiti
- in caso di errore mostra toast "Attenzione: progetto creato ma cartella Drive non creata"
- tutto wrappato in try/catch per non bloccare l'approvazione

Nota: l'`insert` attualmente copia `drive_folder_id` dal budget. Va rimosso (o sovrascritto dopo) altrimenti il progetto punta alla cartella del budget invece della propria.

### 2. `src/components/CreateManualProjectDialog.tsx` — progetto manuale
Dopo l'`insert` del progetto (riga ~245), se `data.client_id` è valorizzato:
- recupera `clients.drive_folder_id` e `clients.name`
- se la cartella cliente esiste, costruisce `folderName = ${year} - ${client.name} - ${data.name}` (no quote_number per progetti manuali)
- chiama `google-drive-folders` con `action: 'create-folder'`
- aggiorna il progetto appena creato con `drive_folder_id` / `drive_folder_name`
- errori non bloccanti, toast informativo

Per ottenere l'`id` del progetto serve cambiare l'`insert` in `.insert([...]).select('id').single()`.

### 3. Nessuna modifica
- `CreateProjectDialog`: ok (crea cartella del budget; il progetto erediterà via QuoteDetail/QuoteStatusSelector creando la propria)
- `QuoteStatusSelector`: già implementato correttamente

## QA
- Approvare un preventivo da `/quotes/:id` → verifica nei log edge function `google-drive-folders` e in DB che `projects.drive_folder_id` sia diverso da `budgets.drive_folder_id`
- Creare un progetto manuale con cliente collegato a Drive → verifica creazione cartella
- Creare progetto manuale senza cliente o con cliente senza `drive_folder_id` → nessun errore, nessuna chiamata Drive
