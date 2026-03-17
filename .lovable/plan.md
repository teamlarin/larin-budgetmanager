

## Piano: AI Insights personalizzati per ruolo

### Problema
1. Il pannello AI Insights è visibile anche per il ruolo `external`, che non dovrebbe vederlo
2. La cache localStorage usa una chiave fissa (`ai-insights-cache`), causando conflitti durante la simulazione ruoli
3. Il backend già differenzia le query per ruolo, ma il frontend non passa il ruolo e non adatta la UI

### Soluzione

**`src/pages/Dashboard.tsx`**: Nascondere `<AiInsightsPanel />` per il ruolo `external`. Passare `userRole` come prop.

**`src/components/AiInsightsPanel.tsx`**:
- Accettare prop `userRole` opzionale
- Rendere la cache key role-aware: `ai-insights-cache-${userRole}` per evitare conflitti nella simulazione ruoli
- Se `userRole === 'external'`, non renderizzare il componente

**`supabase/functions/ai-insights/index.ts`**: Aggiungere query specifiche per i ruoli mancanti:
- `account`: query sui preventivi/quote e pipeline clienti
- `team_leader`: filtrare il workload solo per le aree assegnate (usando `profile.area` e `team_leader_areas`)
- `external`: restituire errore 403 (non autorizzato)
- Personalizzare il system prompt AI per enfatizzare le aree di competenza di ciascun ruolo

### Riepilogo file

| File | Modifica |
|------|----------|
| `src/pages/Dashboard.tsx` | Passare `userRole`, nascondere per external |
| `src/components/AiInsightsPanel.tsx` | Prop `userRole`, cache role-aware, hide per external |
| `supabase/functions/ai-insights/index.ts` | Query account-specific, team_leader area-filtered, block external |

