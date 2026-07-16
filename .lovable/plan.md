## Contesto

Il limite di 1.000 righe di Supabase colpisce ogni query che carica `activity_time_tracking` a livello di progetto (senza filtri di data). Ho ispezionato tutti i 18 file che usano quella tabella. La maggior parte è già a posto — o filtra per singolo utente/giorno (volumi piccoli) o pagina esplicitamente con `.range()` in un `while (hasMore)` (es. `Dashboard.tsx:858-865`, `ProfileHoursBank.tsx:173-182`, `UserHoursSummary.tsx:155-166 / 257-268`, `TeamLeaderDashboard.tsx:327-337`).

Restano **tre punti affetti dallo stesso identico bug** già corretto in `ProjectTimesheet.tsx`. Tutti caricano l'intera storia del time tracking di un progetto in un unico select, quindi sul progetto "Management & pianificazione 2026" (4.150 righe confermate) troncano a 1.000 e falsano i calcoli.

## Punti da correggere

### 1. `src/components/ProjectBudgetStats.tsx` (riga 98)
```ts
await supabase.from('activity_time_tracking').select('*').in('budget_item_id', itemIds);
```
Alimenta il box "Statistiche budget" della pagina progetto: costo del lavoro, ore consumate, margine residuo, % di consumo. Con >1.000 entry sottostima costi e ore → margine residuo mostrato più alto del reale.

### 2. `src/pages/ProjectCanvas.tsx` (riga 286)
```ts
await supabase.from('activity_time_tracking').select('*').in('budget_item_id', items.map(i => i.id));
```
Alimenta i KPI del Canvas progetto (ore per utente, costi effettivi, ecc.). Stesso troncamento.

### 3. `supabase/functions/public-timesheet/index.ts` (riga 120)
```ts
await supabase.from('activity_time_tracking').select('*').in('budget_item_id', budgetItemIds)...
```
È l'edge function usata dal link condivisibile del timesheet (`/timesheet/public?token=...`). Attualmente per progetti grandi il cliente vedrebbe solo un sottoinsieme delle registrazioni.

## Intervento

Applicare a tutti e tre lo stesso pattern già usato in `calculate-project-margins/index.ts` e nella recente fix a `ProjectTimesheet.tsx`:

- Batch di `budget_item_ids` da 100 elementi (per limitare la lunghezza dell'URL).
- Loop `while` con `.range(offset, offset + 999)` finché il batch è pieno (pageSize = 1000).
- Concatenare tutti i risultati e restituirli come prima.

Nessuna altra modifica: firme e consumatori restano identici.

## Fuori scope (verificati e OK)

- `Workload.tsx:104` — filtro `.gte/.lte` su data, range tipico settimana/mese: rischio molto basso; nessuna modifica salvo report di problemi.
- `Dashboard.tsx:290, 298, 431, 1087` — sempre filtrati per singolo `user_id` + range di date, no rischio realistico.
- `Calendar.tsx`, `MultiUserCalendarView.tsx`, `WorkloadSummaryWidget.tsx`, `TeamMemberActivitiesDialog.tsx`, `useWeeklyFocus.ts`, `TimesheetImport.tsx` — tutti scoped per utente e/o giorno/settimana.

## Verifica post-implementazione

- Aprire "Management & pianificazione 2026" → tab **Statistiche budget** e confrontare ore/costi con quelli del Timesheet appena corretto (devono combaciare).
- Aprire il **Canvas** dello stesso progetto: KPI ore effettive coerenti.
- Generare un link condivisibile Timesheet del progetto e verificare che il totale ore mostrato al cliente sia lo stesso della vista interna.
