# Project Leader: possibilità di nascondere i progetti interni dalla lista update

## Obiettivo
Nella tab "Project Leader" della dashboard, aggiungere un interruttore "Nascondi progetti interni" che rimuove i progetti con area `interno` dalla sezione "Update progetti" (e dai conteggi correlati). La scelta è facoltativa: di default i progetti interni restano visibili.

## Modifiche

### 1. `src/hooks/useLeaderProjectsControl.ts`
- Nuovo parametro opzionale `hideInternal?: boolean`, incluso nella `queryKey`.
- Quando attivo, i progetti con `area` uguale a `interno` (confronto case-insensitive) vengono esclusi dall'elenco restituito, prima del mapping.
- `updatesDueCount`, blocchi e KPI derivano già dalla lista filtrata: si aggiornano da soli.

### 2. `src/components/dashboards/TabbedDashboard.tsx`
- Stato `hideInternal` inizializzato da `localStorage` (chiave `leader-hide-internal-projects`, default `false`); ogni cambio viene salvato in `localStorage` così la preferenza persiste tra sessioni.
- Lo stato è unico e passato sia a `useLeaderProjectsControl` (per badge e conteggi della tab) sia a `LeaderControlView`: il badge del conteggio rosso e la lista restano sempre coerenti.

### 3. `src/components/dashboards/LeaderControlView.tsx`
- Nuove props `hideInternal` e `onHideInternalChange`.
- Nell'header della card "Update progetti", accanto alla descrizione: `Switch` + label "Nascondi progetti interni" (stesso stile dell'interruttore "Risolti" dei blocchi).
- Il progetto selezionabile nel dialog "Segnala blocco" usa la stessa lista, quindi i progetti interni nascosti non compaiono nemmeno lì.

## Non incluso
- Nessuna modifica a database, RLS o altre viste (Focus, tab Progetti, canvas): i progetti interni restano visibili ovunque tranne che in questa lista quando l'interruttore è attivo.
- Le segnalazioni di blocco esistenti sui progetti interni restano nella sezione "Blocchi" (non filtrate).

## Verifica
- `bunx tsgo --noEmit`
- Build OK (`/tmp/observability/build-errors.log` pulito).
