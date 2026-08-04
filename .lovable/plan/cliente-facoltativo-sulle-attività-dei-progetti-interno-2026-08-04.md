# Cliente facoltativo sulle attività dei progetti INTERNO

Aggiungere un campo **Cliente** opzionale alle attività previste, attivo **solo** nei progetti con tipologia (billing type) `interno` — es. "Sales & Accounting 2026". Negli altri progetti il campo non compare.

## Cosa cambia per l'utente

- Solo nei progetti di tipologia Interno: nella scheda progetto → Attività previste, ogni attività (e sotto-attività) può essere associata a un cliente dell'anagrafica TimeTrap, oppure lasciata senza cliente.
- Il cliente si imposta nel dialog "Crea nuova attività" e nel dialog di modifica attività, con il selettore ricercabile già usato altrove (incluso "Nessun cliente" per rimuoverlo).
- Nella lista attività compare un badge con il nome del cliente quando presente.
- Nel tab Timesheet dei progetti Interno viene aggiunta la colonna "Cliente" (vuota se l'attività non ne ha uno), inclusa negli export Excel/CSV del timesheet.
- Nei progetti non Interno nulla cambia: nessun campo, nessun badge, nessuna colonna extra.

## Dettagli tecnici

**Database (migrazione)**
- `ALTER TABLE public.budget_items ADD COLUMN client_id uuid NULL REFERENCES public.clients(id) ON DELETE SET NULL;`
- Indice su `client_id`. Nessuna modifica alle policy RLS: si eredita l'accesso già in vigore su `budget_items`; `clients` è già leggibile dagli utenti approvati. Il vincolo "solo progetti interno" è applicato lato UI (stesso approccio già usato per la categoria "Off").

**Frontend**
- `src/types/budget.ts`: aggiungere `clientId?: string | null` a `BudgetItem`.
- `src/components/ProjectActivitiesManager.tsx`:
  - gate `isInterno = projectData?.billing_type === 'interno'` (stessa fonte già usata per filtrare le categorie).
  - estendere l'interfaccia locale dell'attività con `client_id`; includere `client_id` nelle select.
  - se `isInterno`: caricare l'elenco clienti (`id, name`) e mostrare `ClientSelector` con opzione di rimozione nei dialog di creazione e modifica; salvare `client_id` in insert/update; badge cliente nelle righe attività e sotto-attività.
- `src/components/ProjectTimesheet.tsx`: aggiungere `client_id` alla select di `budget_items`, mappare id → nome cliente, e mostrare la colonna "Cliente" (tabella + export) solo quando il progetto è di tipologia `interno`.

**Fuori scopo**
- Nessun campo cliente nei budget/preventivi, nel calendario o negli altri export.

