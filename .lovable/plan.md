

## Dividere la dashboard Operations in due sezioni: Progetti e Team

### Situazione attuale
La dashboard Operations (`AdminOperationsDashboard`) mostra tutto in un unico flusso verticale:
1. Header "Area Progetti e Risorse"
2. 4 stat cards (scadenza, partenza, recurring, pack)
3. Widget "Situazioni critiche" (progetti a rischio + utenti sovraccarichi)
4. Widget "Carico di lavoro team" (`WorkloadSummaryWidget`)

Tutto è mischiato senza una separazione visiva chiara tra dati progetti e dati team.

### Piano

**File: `src/components/dashboards/AdminOperationsDashboard.tsx`**

Dividere il contenuto in due sezioni visivamente distinte con header dedicati:

**Sezione 1 — "Progetti"**
- Header con barra colorata: "Progetti"
- Le 4 stat cards (scadenza, partenza, recurring, pack)
- Sub-sezione "Situazioni critiche" solo per i **progetti a rischio** (estratta dal widget critico attuale)

**Sezione 2 — "Team"**
- Header con barra colorata: "Team"
- Sub-sezione "Situazioni critiche" solo per gli **utenti sovraccarichi** (estratta dal widget critico attuale)
- Widget `WorkloadSummaryWidget` (carico di lavoro)

### Dettagli tecnici
- Il widget "Situazioni critiche" viene spezzato: la parte progetti va nella sezione Progetti, la parte utenti sovraccarichi va nella sezione Team
- Ogni sezione ha il proprio header con la barra colorata verticale (stesso pattern già usato)
- Nessuna modifica ai props o al `Dashboard.tsx` — solo riorganizzazione interna del layout

