

# Piano: Miglioramento Dashboard per tutti i ruoli

## Problemi identificati

1. **MemberDashboard layout disordinato**: Stats → Grafici → Trend → Calendario → Attività → Progetti. Le info operative (calendario, attività di oggi) sono troppo in basso.
2. **Finance senza recap personale**: Usa `FinanceDashboard` direttamente, non è wrappato in `TabbedDashboard`.
3. **Coordinator senza tab di ruolo**: Usa `MemberDashboard` direttamente senza `TabbedDashboard`.
4. **Nessuna sezione hero**: Manca un riepilogo immediato "cosa fare oggi".

## Modifiche previste

### 1. Hero "Cosa fare oggi" (`MemberDashboard.tsx`)
Aggiungere sopra le stats card una sezione compatta con:
- Numero attività da fare oggi e ore rimanenti da confermare
- Prossima attività (nome + orario)
- Alert se ci sono progetti in scadenza entro 3 giorni (tra quelli come leader)

### 2. Riordino layout `MemberDashboard.tsx`
Nuovo ordine dei widget:
1. Hero "Cosa fare oggi"
2. Stats card (5 card attuali)
3. Calendario settimanale
4. Attività oggi + Prossime attività
5. Progetti come leader / come membro
6. Ore per progetto + Ore per categoria (grafici)
7. Trend produttività + Trend ore mensili

### 3. Finance con recap personale (`Dashboard.tsx`)
Wrappare `FinanceDashboard` in `TabbedDashboard` con tab "Il mio Recap" + "Finance", passando `memberData` come per Admin/Account.

### 4. Coordinator con `TabbedDashboard` (`Dashboard.tsx`)
Wrappare il Coordinator in `TabbedDashboard`. Per ora solo tab "Il mio Recap" (senza tab role-specific aggiuntiva, ma la struttura è pronta per future espansioni).

## File da modificare

| File | Modifica |
|------|----------|
| `src/components/dashboards/MemberDashboard.tsx` | Hero section + riordino layout |
| `src/pages/Dashboard.tsx` | Finance e Coordinator wrappati in TabbedDashboard |

Nessuna modifica al database.

