

## Piano di implementazione — Funzionalità utente esterno

### 1. Reinvio link di accesso

**Problema attuale**: L'invito usa `signInWithOtp` che non è reinviabile dalla UI admin. Per reinviare il magic link serve un pulsante dedicato.

**Soluzione**: Aggiungere un pulsante "Reinvia link" nella tabella di `ExternalUserManagement.tsx` per ogni utente esterno. Il pulsante chiama `supabase.auth.signInWithOtp({ email })` con l'email dell'utente — invia un nuovo magic link.

**File**: `src/components/ExternalUserManagement.tsx`

---

### 2. Lista progetti filtrata per utente esterno

**Problema attuale**: La query in `ApprovedProjects.tsx` si basa su RLS per filtrare i progetti, ma la policy RLS per external potrebbe non funzionare correttamente oppure mostra tutti i progetti.

**Soluzione**: Aggiungere in `ApprovedProjects.tsx` una logica client-side: se `userRole === 'external'`, prima recuperare i `project_id` da `external_project_access` e poi filtrare i risultati. Se nessun progetto è assegnato, mostrare una lista vuota con messaggio informativo.

**File**: `src/pages/ApprovedProjects.tsx`

---

### 3. Creazione attività nel progetto assegnato

**Problema attuale**: L'utente external deve poter creare budget_items (attività) nei progetti assegnati. Serve verificare che le RLS policy consentano INSERT per external su `budget_items` e che il Project Canvas non blocchi la UI.

**Soluzione**: 
- Verificare la RLS policy su `budget_items` per INSERT da parte di external users (la migration attuale copre SELECT e UPDATE ma potrebbe mancare INSERT)
- Aggiungere una migration per consentire INSERT su `budget_items` per external users nei progetti assegnati
- Verificare che il Project Canvas mostri il pulsante "Aggiungi attività" per external users

**File**: Migration SQL, eventualmente `src/pages/ProjectCanvas.tsx`

---

### 4. Visibilità calendario per utenti specifici (selezionati dall'admin)

**Problema attuale**: L'utente external vede nel calendario TUTTI i membri dei progetti assegnati. L'admin vuole poter scegliere QUALI utenti specifici l'external può vedere.

**Soluzione**:
- **Database**: Creare tabella `external_visible_users` con colonne `id`, `external_user_id`, `visible_user_id`, `granted_by`, `created_at`. RLS: admin gestisce tutto, external vede solo i propri record.
- **Admin UI**: In `ExternalUserManagement.tsx`, aggiungere (accanto all'assegnazione progetti) un dialog per selezionare quali utenti del team l'external può vedere nel calendario.
- **Calendario**: In `Calendar.tsx`, modificare la query `externalAccessibleUserIds` per usare `external_visible_users` invece di derivare gli utenti dai progetti.

**File**: Migration SQL, `src/components/ExternalUserManagement.tsx`, `src/pages/Calendar.tsx`

---

### Riepilogo modifiche

| File | Modifica |
|------|----------|
| Migration SQL | RLS INSERT su `budget_items` per external, tabella `external_visible_users` |
| `ExternalUserManagement.tsx` | Pulsante reinvia link, gestione utenti visibili nel calendario |
| `ApprovedProjects.tsx` | Filtro progetti per external user |
| `Calendar.tsx` | Query utenti visibili da `external_visible_users` |
| `ProjectCanvas.tsx` | Verifica UI creazione attività per external |

