# Cliente facoltativo sulle attività di progetto

Aggiungere un campo **Cliente** opzionale alle attività previste dei progetti (es. "Sales & Accounting 2026"), scelto dall'anagrafica clienti già presente in TimeTrap.

## Cosa cambia per l'utente

- Nella scheda progetto → Attività previste, ogni attività (e sotto-attività) può essere associata a un cliente, oppure lasciata senza cliente.
- Il cliente si imposta nel dialog "Crea nuova attività" e nel dialog di modifica attività, con lo stesso selettore ricercabile usato altrove (incluso "Nessun cliente" per rimuoverlo).
- Nella lista attività compare un badge con il nome del cliente quando presente.
- Nel tab Timesheet del progetto viene aggiunta la colonna "Cliente" (valore vuoto se l'attività non ne ha uno), inclusa negli export Excel/CSV del timesheet.

## Dettagli tecnici

**Database (migrazione)**
- `ALTER TABLE public.budget_items ADD COLUMN client_id uuid NULL REFERENCES public.clients(id) ON DELETE SET NULL;`
- Indice su `client_id`. Nessuna modifica alle policy RLS: si eredita l'accesso già in vigore su `budget_items`; `clients` è già leggibile dagli utenti approvati.

**Frontend**
- `src/types/budget.ts`: aggiungere `clientId?: string | null` a `BudgetItem`.
- `src/components/ProjectActivitiesManager.tsx`:
  - estendere l'interfaccia locale dell'attività con `client_id`; includere `client_id` nelle select.
  - caricare l'elenco clienti (`id, name`) e riusare `ClientSelector` con opzione di rimozione nei dialog di creazione e modifica.
  - salvare `client_id` in insert/update; mostrare il badge cliente nelle righe attività e sotto-attività.
- `src/components/ProjectTimesheet.tsx`: aggiungere `client_id` alla select di `budget_items`, mappare l'id al nome cliente, nuova colonna in tabella e nei due export.

**Fuori scopo**
- Nessun campo cliente nei budget/preventivi, nel calendario o negli export delle attività di progetto.
