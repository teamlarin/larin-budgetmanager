

# Miglioramenti alla tabella Budget

## Problemi attuali

La tabella ha **11 colonne** (con checkbox), troppe per una lettura rapida. Alcune colonne hanno basso valore informativo nella lista (Proprietario, Data creazione) e il badge dello stato duplica la logica già presente in `BudgetStatusBadge` senza riusarla. L'importo non mostra le ore associate. La colonna "Assegnato a" non è inline-editabile come le altre.

## Modifiche proposte

### 1. Rimuovere colonna "Proprietario"
In un flusso dove l'Account crea e assegna, il "Proprietario" (creatore) è quasi sempre l'Account stesso. Ridondante. Lo si può vedere nel dettaglio budget.

### 2. Rendere "Assegnato a" inline-editabile
Come già fatto per Cliente, Account e Stato — aggiungere il pattern edit-on-hover con Select per la colonna "Assegnato a".

### 3. Riusare `BudgetStatusBadge` nella colonna Stato
Attualmente la colonna Stato usa badge inline con logica duplicata. Sostituire con il componente `BudgetStatusBadge` già esistente, mantenendo l'edit-on-hover.

### 4. Mostrare ore accanto all'importo
Nella cella importo, sotto il valore in euro aggiungere le ore totali in formato compatto (es. `12.500 € · 80h`).

### 5. Colonna "Data creazione" → formato compatto
Usare formato `dd/MM/yy` invece di `dd/MM/yyyy` per risparmiare spazio.

### 6. Colonna "Disciplina" (opzionale, compatta)
Aggiungere un piccolo badge con la disciplina (se presente) accanto al nome del budget, non come colonna separata.

## File da modificare

| File | Modifica |
|------|----------|
| `src/pages/Index.tsx` | Rimuovere colonna Proprietario, inline-edit per Assegnato a, riusare BudgetStatusBadge, ore nell'importo, data compatta, badge disciplina nel nome |

## Dettaglio tecnico

- Rimuovere `<TableHead>Proprietario</TableHead>` e relativa `<TableCell>`
- Aggiungere `startEditing(project.id, 'assigned')` pattern con Select di utenti
- Creare handler `handleUpdateAssigned` simile a `handleUpdateAccount`
- Importare e usare `BudgetStatusBadge` nel rendering non-editing dello stato
- Nella cella importo: `{project.total_budget.toFixed(2)} € · {project.total_hours}h`
- Data: cambiare `year: 'numeric'` → `year: '2-digit'`

