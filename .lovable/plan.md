

## Collegamento servizi al budget + Preventivi con budget multipli

Due interventi principali: (1) gestire i servizi collegati al budget dalla pagina budget singolo, (2) supportare preventivi con budget multipli tramite tabella ponte.

---

### Parte 1: Collegamento servizi al budget (post-creazione)

**Problema attuale**: I servizi vengono collegati al budget solo durante la creazione (via `budget_services`), oppure implicitamente tramite `budget_template_id`. Non c'è modo di aggiungere/rimuovere servizi dopo la creazione.

**Intervento**:

**1A. Pagina ProjectBudget.tsx** - Aggiungere sezione "Servizi collegati" tra i dettagli e il BudgetManager:
- Query dei servizi collegati tramite tabella `budget_services` (join con `services`)
- Lista servizi attuali con possibilità di rimuoverli
- Pulsante "Aggiungi servizio" con dialog/select per scegliere tra i servizi disponibili
- Insert/delete su `budget_services`

**1B. BudgetManager.tsx** - Aggiornare `handleGeneratePdf` per usare `budget_services` invece di `services.budget_template_id`:
- Fetch servizi da `budget_services` (join `services`) per il budget corrente
- Rimuovere la dipendenza da `budget_template_id` per la ricerca servizi nel preventivo

**1C. QuoteDetail.tsx** - Aggiornare query servizi per usare `budget_services`:
- Sostituire la query che cerca `services.budget_template_id` con una query tramite `budget_services`
- Ogni servizio avrà il suo `net_price` dal catalogo, sovrascrivibile

---

### Parte 2: Preventivi con budget multipli

**Problema attuale**: `quotes` ha un singolo campo `budget_id`. Un preventivo non può contenere più budget.

**Intervento**:

**2A. Migrazione DB** - Creare tabella ponte `quote_budgets`:
```sql
CREATE TABLE public.quote_budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  budget_id uuid NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(quote_id, budget_id)
);

-- RLS policies
ALTER TABLE public.quote_budgets ENABLE ROW LEVEL SECURITY;

-- Approved users can manage quote_budgets
CREATE POLICY "Approved users can manage quote_budgets" ON public.quote_budgets
  FOR ALL TO authenticated USING (is_approved_user(auth.uid()));

-- Migrare dati esistenti
INSERT INTO public.quote_budgets (quote_id, budget_id)
SELECT id, budget_id FROM quotes WHERE budget_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

**2B. QuoteDetail.tsx** - Adattare per budget multipli:
- Query `quote_budgets` per ottenere tutti i budget collegati
- Per ogni budget, fetch servizi da `budget_services` e prodotti da `budget_items`
- Raggruppare prodotti e servizi per budget nella UI
- Pulsante per aggiungere budget esistenti al preventivo

**2C. BudgetManager.tsx** - Aggiornare generazione preventivo:
- Inserire record in `quote_budgets` oltre a `quotes.budget_id` (backward compatibility)

**2D. Quotes.tsx** - Lista preventivi:
- Adattare per mostrare i nomi dei budget collegati (potenzialmente multipli)

---

### Riepilogo file modificati
- **Migrazione SQL**: nuova tabella `quote_budgets`
- **`src/pages/ProjectBudget.tsx`**: sezione servizi collegati
- **`src/components/BudgetManager.tsx`**: fetch servizi da `budget_services`, insert in `quote_budgets`
- **`src/pages/QuoteDetail.tsx`**: query servizi da `budget_services`, supporto multi-budget
- **`src/pages/Quotes.tsx`**: adattamento lista per multi-budget

