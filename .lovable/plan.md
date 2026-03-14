

# Miglioramento scheda singolo Budget

## Analisi stato attuale

La pagina `ProjectBudget.tsx` ha un header piatto con metadati sparsi in una griglia 2 colonne, senza una chiara gerarchia informativa. Mancano elementi chiave per l'account che deve generare il preventivo.

## Problemi identificati

1. **Referente cliente assente** — Il campo `client_contact_id` esiste nel DB (`budgets` table) ma non è mostrato né editabile nella scheda budget. L'account non vede chi è il referente.
2. **Nessun link al preventivo generato** — I dati della quote vengono fetchati (`project.quote`) ma non mostrati. L'account non sa se esiste già un preventivo e non può raggiungerlo direttamente.
3. **Disciplina e Area non visibili** — Sono campi presenti nel DB ma non mostrati nell'header.
4. **Header disorganizzato** — Tutti i campi sono in una griglia piatta senza raggruppamento logico. Per l'account che deve preparare un preventivo, le informazioni chiave (cliente, referente, importo, stato) dovrebbero essere immediatamente visibili.
5. **Marginalità nascosta** — Il valore è nel toolbar del BudgetManager, non nel contesto dell'header dove sarebbe più utile come dato riepilogativo.

## Modifiche proposte

### 1. Riorganizzare l'header in sezioni logiche

Dividere l'header in due card affiancate:
- **Card sinistra "Dettagli progetto"**: Nome, descrizione, modello, obiettivi, disciplina, area, brief link, data creazione
- **Card destra "Persone e cliente"**: Cliente (editabile), Referente (editabile, nuovo), Account (editabile), Assegnato a (editabile), Creato da

### 2. Aggiungere selettore Referente cliente

Riusare il componente `ClientContactSelector` già esistente (usato in ProjectCanvas) per permettere all'account di selezionare il referente direttamente dalla scheda budget. Salvare su `budgets.client_contact_id`.

### 3. Aggiungere banner "Preventivo collegato"

Se `project.quote` esiste, mostrare un banner informativo sotto l'header con:
- Numero preventivo e stato (badge colorato)
- Link diretto alla pagina del preventivo (`/quotes/{id}`)
- Se non esiste ancora: nessun banner (il bottone "Genera Preventivo" è già nel BudgetManager)

### 4. Mostrare Disciplina e Area

Aggiungere nell'header i campi Disciplina e Area con badge colorati e possibilità di editing inline (Select).

### 5. Riepilogo importi nell'header

Aggiungere sotto le card un mini-riepilogo compatto: **Totale · Ore · Marginalità · Sconto** in una riga, così l'account ha il quadro economico senza scrollare fino alla summary card.

## File da modificare

| File | Modifica |
|------|----------|
| `src/pages/ProjectBudget.tsx` | Riorganizzare header in card, aggiungere referente, banner preventivo, disciplina/area, riepilogo importi |

Non servono migrazioni DB — tutti i campi (`client_contact_id`, `discipline`, `area`) esistono già nella tabella `budgets`.

