# Webhook Make: inviare la tipologia di fatturazione del progetto

## Obiettivo
Nel payload dei webhook Make il campo "tipologia progetto" deve indicare il tipo di fatturazione del progetto (`one_shot`, `recurring`, `consumptive`, `pack`, `pre_sales`, `interno`), invece del vecchio valore legacy `project_type` (es. "Manuale" per i progetti creati a mano).

## Contesto verificato
- La colonna `projects.billing_type` esiste già (valori coerenti con le costanti `billingTypes` dell'app).
- `project-completed-webhook` invia `project_type` ma non `billing_type`.
- `send-recurring-quarter-webhook` seleziona `billing_type` solo per filtrare i recurring, ma non lo include nel payload.

## Modifiche

### 1. `supabase/functions/project-completed-webhook/index.ts`
- Aggiungere `billing_type` alla select del progetto.
- Aggiungere al payload:
  - `billing_type`: valore grezzo (es. `one_shot`)
  - `billing_type_label`: etichetta leggibile (es. "One-Shot", "Recurring", "Pack")
- Mantenere `project_type` invariato per non rompere gli scenari Make esistenti.

### 2. `supabase/functions/send-recurring-quarter-webhook/index.ts`
- Stesse aggiunte al payload (`billing_type`, `billing_type_label`).
- Il campo `billing_type` è già nella select: basta includerlo nel payload.

### 3. Deploy
- Deploy di entrambe le Edge Function.

## Nota per Make
Negli scenari Make esistenti, rimappare il campo "tipologia progetto" da `project_type` al nuovo `billing_type` (o `billing_type_label`). `project_type` resta disponibile nel payload per retrocompatibilità.

## Verifica
- Test di invocazione di entrambe le funzioni su un progetto reale e controllo del payload (campi `billing_type` / `billing_type_label` presenti e valorizzati).
