

## Suggerimenti utenti per livello anche in modifica attività

### Problema
Nella vista di modifica di un'attività budget (`isEditing && !formData.isProduct`), il selettore "Figura" c'è e chiama `handleLevelChange`, ma mancano due cose:
1. Il box con gli utenti suggeriti (`suggestedUsers`) non viene mostrato dopo il selettore
2. Quando si apre il dialog in modifica, gli utenti suggeriti per il livello già assegnato non vengono caricati automaticamente

### Modifiche — `src/components/BudgetItemForm.tsx`

1. **Caricare suggerimenti all'apertura in modifica**: nell'`useEffect` che gestisce `initialData` (riga ~110), se `initialData.assigneeId` esiste e corrisponde a un livello, chiamare la query per caricare gli utenti con quel `level_id`

2. **Mostrare il box suggerimenti**: dopo il selettore "Figura" nella sezione editing (dopo riga ~893), aggiungere lo stesso blocco `suggestedUsers` già presente nella tab "custom" (righe 624-634)

### File modificato
- `src/components/BudgetItemForm.tsx`

