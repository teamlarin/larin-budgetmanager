

## Analisi: Accesso Esterno ai Progetti

### Pro e contro dei due approcci di accesso

**Link magico senza account (consigliato per il tuo caso):**
- Pro: Zero frizione per l'utente esterno, nessuna approvazione admin necessaria, simile al PublicTimesheet già esistente
- Pro: L'utente esterno non appare nei team, non inquina la lista utenti
- Con: Meno tracciabilità (nessun user_id nativo), serve un sistema di token custom
- Con: Per funzionalità interattive (assegnare attività) serve un meccanismo di autorizzazione custom via edge function

**Account con ruolo "external" (più robusto):**
- Pro: Usa RLS nativo, audit trail completo, si integra nel sistema permessi esistente
- Pro: L'assegnazione attività funziona con le API standard Supabase
- Pro: Il calendario è già costruito per utenti autenticati — riusare la logica è immediato
- Con: L'utente esterno deve registrarsi (ma si può semplificare con magic link di Supabase Auth)

**Raccomandazione:** Account con ruolo `external` + invito via magic link di Supabase Auth. L'utente esterno riceve un'email, clicca il link e accede direttamente — nessuna password da scegliere. Questo dà il meglio di entrambi: frictionless per l'utente, ma con RLS e audit trail nativi.

---

### Piano di implementazione

#### 1. Database — Nuovo ruolo e tabelle

- Aggiungere `'external'` all'enum `app_role`
- Creare tabella `external_project_access`:
  - `id`, `user_id` (utente esterno), `project_id`, `created_at`, `granted_by` (admin che ha dato accesso)
  - RLS: admin possono gestire, utente esterno vede solo i propri record
- Aggiungere riga `external` nella tabella `role_permissions` con tutti i permessi a `false`

#### 2. Permessi — Ruolo "external"

- Aggiornare `UserRole` type in `permissions.ts` con `'external'`
- Aggiungere permessi default per `external`: tutto `false` tranne visibilità progetti assegnati
- Aggiornare `AppLayout.tsx` per gestire il ruolo `external` (navigazione ridotta: solo Calendario e Progetti)
- L'utente esterno NON vede: Budget, Preventivi, Settings, Workload, Workflows

#### 3. Logica di accesso ai progetti

- Modificare le query dei progetti per includere `external_project_access` — l'utente esterno vede solo i progetti a cui è stato esplicitamente assegnato
- Nel Project Canvas: vista read-only, tab Attività visibile, tab Budget/Costi nascosta
- L'utente esterno può assegnare attività (modificare `assignee_id` su `budget_items`) nei progetti a cui ha accesso

#### 4. Calendario

- L'utente esterno può vedere il calendario dei membri del team nei progetti a cui ha accesso
- Aggiungere `'external'` a `CALENDAR_VIEWER_ROLES` in `calendarTypes.ts`
- Filtrare la lista utenti visibili nel calendario in base ai progetti assegnati

#### 5. UI — Gestione utenti esterni (admin)

- Nella pagina Settings, aggiungere una sezione "Utenti Esterni" dove l'admin può:
  - Invitare un utente esterno via email (magic link Supabase)
  - Assegnare/rimuovere progetti specifici
  - Vedere la lista degli utenti esterni attivi

#### 6. Navigazione dedicata

- Header semplificato per il ruolo `external`: solo Calendario, Progetti assegnati, Profilo
- Nessun accesso a: Budget, Preventivi, Settings, Workload, Workflows, Help avanzato

### Dettagli tecnici

```text
┌──────────────┐     ┌─────────────────────────┐     ┌──────────────┐
│  Admin        │────▶│ external_project_access  │◀────│ External User│
│ (grants)      │     │ user_id, project_id      │     │ (role=external)│
└──────────────┘     └─────────────────────────┘     └──────────────┘
                              │
                              ▼
                     ┌──────────────┐
                     │   projects   │
                     │ (filtered)   │
                     └──────────────┘
```

**Migration SQL (schema):**
- `ALTER TYPE app_role ADD VALUE 'external'`
- `CREATE TABLE external_project_access(...)`
- `INSERT INTO role_permissions (role, ...) VALUES ('external', false, false, ...)`

**File da modificare:**
- `src/lib/permissions.ts` — aggiungere `external` al type e ai default
- `src/components/AppLayout.tsx` — navigazione ridotta per external
- `src/components/AppHeader.tsx` — menu ridotto
- `src/components/calendar/calendarTypes.ts` — aggiungere external ai viewer roles
- `src/pages/Calendar.tsx` — filtrare utenti visibili per external
- `src/pages/Settings.tsx` — sezione gestione utenti esterni
- `src/pages/Dashboard.tsx` — redirect/dashboard dedicata per external

