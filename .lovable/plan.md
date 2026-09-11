# Customer satisfaction auto

Nuovo campo "Customer satisfaction auto" (Sì / No, default Sì) su budget e progetto, inviato a Make quando il progetto viene completato.

## Cosa cambia per te

- Nella scheda **budget** compare un selettore "Customer satisfaction auto" con valore predefinito **Sì**.
- Quando il budget diventa progetto, il valore viene copiato sul progetto.
- Nella scheda **progetto** il campo resta modificabile.
- Quando il progetto passa a **completato**, il messaggio inviato a Make include il nuovo dato.

## Dettagli tecnici

1. Migrazione: colonna `customer_satisfaction_auto boolean NOT NULL DEFAULT true` su `public.budgets` e `public.projects` (i record esistenti risultano "Sì").
2. `src/lib/createProjectFromOffer.ts`: propaga `customer_satisfaction_auto` dal budget al progetto in fase di insert.
3. UI:
   - `src/pages/ProjectBudget.tsx`: nuovo Select/Switch nel blocco informazioni, salvataggio via `handleUpdateField`, rispettando i permessi di modifica già in uso.
   - `src/pages/ProjectCanvas.tsx`: stesso controllo nella scheda progetto, con le stesse regole di permesso degli altri campi editabili.
   - `src/types/project.ts`: aggiunta del campo all'interfaccia.
4. Webhook: `supabase/functions/project-completed-webhook/index.ts` aggiunge `customer_satisfaction_auto` alla select del progetto e al payload `ProjectCompletedPayload`. Il trigger DB resta invariato (parte solo al passaggio a `completato`).

## Verifiche

- Typecheck, test e build.
- Controllo su un progetto esistente: il campo mostra "Sì" e il salvataggio del cambio a "No" persiste.
