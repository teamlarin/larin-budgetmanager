## Feature: Focus della settimana

Vista personalizzata dei progetti su cui ogni utente deve concentrarsi questa settimana, integrata nella dashboard personale.

## Suggerimenti di miglioramento rispetto alla spec originale

1. **Niente tabella cache `user_weekly_focus` né cron job**  
   Il calcolo è leggero e React Query già fa caching client-side. Cache JSONB + cron aggiungerebbero complessità per zero beneficio percepibile.

2. **Niente dipendenza da Feature #8 (`criticality_score`)** — non esiste oggi nel codebase. Sostituiamo quel fattore con segnali già disponibili:
   - % budget ore consumato (da `activity_time_tracking` vs `budget_items`)
   - giorni dall'ultimo `project_progress_updates` (segnale di "rischio dimenticato")

3. **Sostituire "task aperta prioritaria"** — non esiste una tabella tasks per progetto. Usiamo la **prossima attività pianificata in calendario** dell'utente su quel progetto (`activity_time_tracking` con `scheduled_date >= oggi`).

4. **Vista Focus di un altro membro per il Team Leader → rimandata a v2**  
   Aggiunge UI di selezione e considerazioni RLS che dilatano lo scope. Validiamo prima il valore della vista per l'utente stesso.

5. **Azioni rapide su ogni card**: Apri canvas / Pianifica nel calendario / Aggiorna progresso. Riducono i click del lunedì mattina, che è il vero obiettivo.

6. **Stato vuoto curato**: se l'utente non ha urgenze (account, freelance, nuovo entrato), mostriamo i progetti con più ore pianificate invece di una pagina bianca.

## Cosa costruire

### 1. Tab "Focus Settimana" in `TabbedDashboard`
- Visibile per tutti i ruoli tranne `external`
- **Tab di default il lunedì** (`new Date().getDay() === 1`); negli altri giorni resta "Il mio Recap"

### 2. `WeeklyFocusView` — `src/components/dashboards/WeeklyFocusView.tsx`

Layout:
```text
Header: "Focus settimana 21–27 Apr · Ciao Marco"
🔴 Urgente        (focusScore ≥ 70)
🟡 In scadenza    (focusScore 40–69)
🟢 In corso       (focusScore 15–39)
Footer: "Non vedi un progetto? → Tutti i progetti"
```

Card progetto:
- Cliente · nome progetto · badge area (riusa `lib/areaColors.ts`)
- Deadline (`dd/MM`, "tra X giorni")
- % budget ore consumato (barra, soglie 75/90)
- Ore pianificate dall'utente questa settimana
- Prossima attività pianificata
- 3 azioni: Apri canvas / Pianifica / Aggiorna progresso

### 3. Hook `useWeeklyFocus` — `src/hooks/useWeeklyFocus.ts`

```text
Input: userId, weekStart (lunedì calcolato con date-fns)
1. Fetch progetti dove user è project_leader_id, account_user_id,
   assigned_user_id, o presente in project_members.
   Filtri: status='approvato', project_status in ('aperto','in_partenza').
2. Per ogni progetto in parallelo:
   - % budget ore consumato (sum activity_time_tracking confermate / sum budget_items.hours_worked)
   - ore pianificate dell'utente nella settimana
   - prossima activity_time_tracking pianificata
   - giorni a end_date
   - giorni dall'ultimo project_progress_updates
3. focusScore =
     deadline ≤ fine settimana       → +50
     deadline ≤ 14 giorni            → +20
     budget consumato > 90%          → +25
     budget consumato > 75%          → +10
     ore pianificate > 0             → +15
     nessun progress update da >14gg → +10
4. Filtra focusScore > 0, ordina desc, top 7.
5. Fallback stato vuoto: top 5 progetti per ore pianificate.
```

Batching `.in()` su array di project IDs (max 100 per chunk) come da memoria.

### 4. Permessi
Riusa `useRolePermissions`. Tab nascosta se `role === 'external'`.

## Acceptance Criteria

- [x] Tab "Focus Settimana" nella dashboard personale (tutti tranne external)
- [x] Tab di default il lunedì
- [x] Max 7 progetti, raggruppati Urgente / In scadenza / In corso
- [x] Per progetto: nome, deadline, % budget, ore pianificate utente, prossima attività
- [x] Azioni rapide: apri canvas / pianifica / aggiorna progresso
- [x] Stato vuoto con fallback
- [ ] (rimandato a v2) vista Focus di un membro per il Team Leader

## File toccati / creati

- `src/hooks/useWeeklyFocus.ts` (nuovo)
- `src/components/dashboards/WeeklyFocusView.tsx` (nuovo)
- `src/components/dashboards/TabbedDashboard.tsx` (aggiunta tab + default lunedì)
- `src/pages/Dashboard.tsx` (passare `userId`)

Nessuna migrazione SQL, nessuna nuova edge function, nessun cron.
