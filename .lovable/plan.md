# Fix: 171 vs 183 progetti aperti (admin)

## Causa confermata

Nel tab Progetti admin la card "In corso" conta **171** perché la query `teamLeaderData` filtra sempre i progetti per `area IN (assignedAreas)`. Per l'admin `assignedAreas` viene calcolato leggendo le aree distinte dalla tabella `profiles` — che sono in **minuscolo** (`marketing`, `tech`, `branding`, `sales`, `struttura`, `ai`).

I progetti però hanno l'`area` salvata in **camel/capitalized** (`Marketing`, `Tech`, `Branding`, `interno`) oppure `NULL`. Il match è case-sensitive, quindi 16 progetti aperti vengono esclusi:

- Marketing: 5
- Tech: 4
- Branding: 2
- interno: 1
- (null): 4

Totale escluso: 16 → 187 - 16 = **171** (esattamente il numero mostrato in card). La pagina Progetti non applica questo filtro e ne mostra ~183.

## Fix

Nel ramo admin di `useQuery('team-leader-dashboard-stats', …)` in `src/pages/Dashboard.tsx` **saltare del tutto il filtro per area**: l'admin deve vedere tutti i progetti, indipendentemente dall'area (inclusi quelli con `area = NULL`).

Modifiche puntuali:

1. Impostare `assignedAreas` a `[]` per l'admin e passare un flag `isAdmin = userRole === 'admin'` alla logica successiva.
2. Nei tre `.in('area', assignedAreas)` (progetti attivi, progetti in scadenza, progetti completati anno) e nel filtro membri del team, applicare `.in('area', assignedAreas)` **solo se `!isAdmin`**.
3. Rimuovere il ritorno "empty data" quando `assignedAreas.length === 0` per l'admin (deve procedere comunque).
4. Nessun'altra modifica alla UI: la card `projectsInProgress` continuerà a leggere il conteggio corretto.

## Effetto atteso

- Card "In corso" admin: passerà da 171 a **~187** (tutti i progetti con `project_status = 'aperto'`).
- Coerenza con la pagina Progetti.
- Team leader: comportamento invariato (continua a filtrare per aree assegnate).

## Nota separata (non inclusa nel fix)

Le aree dei progetti sono inconsistenti (`Marketing` vs `marketing`, `interno` non presente in profiles). Vale la pena in seguito normalizzarle tutte in minuscolo con una migrazione dedicata, ma è fuori scope da questa richiesta.
