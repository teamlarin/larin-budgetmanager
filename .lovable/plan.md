

## Aggiornamento sezione `/help` con novità recenti

### Obiettivo
Allineare la documentazione `/help` alle funzionalità rilasciate dall'ultima stesura della guida (gen-apr 2026) e popolare il changelog "🆕 Novità" oggi vuoto.

### Novità da documentare (raccolte da memorie + codice)

**Nuove sezioni applicative**
- **Performance Reviews**: schede personali in Profilo + gestione admin in Impostazioni (obiettivi annuali, note trimestrali, punti di forza, aree di miglioramento, leadership/sales con bonus %)
- **Progetti Approvati** (`/approved-projects`): pagina dedicata al monitoraggio criticità (>85% budget, <7gg deadline, margine basso)
- **Banca Ore** in Profilo: saldo annuale YTD, riporti, dettaglio mensile, previsionale
- **Workflows v2**: dipendenze tra task (`dependsOn`), commenti, scadenze individuali, lock a cascata
- **Maggiorazioni Timesheet**: % per utente/categoria nel canvas progetto
- **Timesheet pubblica v3**: token con scadenza e flag per nascondere dettagli
- **Data chiusura attesa** sui budget (per simulazioni risorse)

**Miglioramenti esistenti**
- **Notifiche progressive di budget** (warning a 50/75/90/100% e proiezione >10%/>25%)
- **AI Insights** personalizzati per ruolo + cache locale
- **Riepilogo settimanale AI** ogni lunedì 09:00 via email
- **Promemoria automatici**: timesheet mensile, pianificazione settimanale, margini critici
- **Slack notifications** su 3 scenari (nuovo progetto, aggiornamenti, completamento)
- **Google Calendar v2** con stato/redirect-path
- **Fatture in Cloud**: token unificati, OAuth con buffer 5min
- **Google Sheet sync** clienti (6h) e budget drafts (3x/giorno)
- **Ruolo External**: collaboratori esterni via magic link
- **Ruolo Coordinator**: gestione catalog/budget read-only
- **Simulazione ruolo** per gli admin
- **Periodi contrattuali** dinamici (`user_contract_periods`) con ore attese variabili
- **Project Leader** unificato: supersede dei vincoli di membership
- **Quotes**: aggregazione multi-budget (`quote_budgets`), simulatore margine bidirezionale 30%, prezzi netti in lista
- **Progress tracking v6**: % automatica per `recurring`/`pack`
- **Budget Target**: 70% del costo attività (Project Canvas)
- **Multi-company contacts**: contatto su più clienti
- **Timeline export**: A3 landscape PDF
- **Timesheet import v3**: CSV con virgola/punto e virgola, mapping LCS 0.6
- **Sicurezza**: roles in tabella separata, exceljs (no xlsx), cron auth via `CRON_SECRET`

### File da modificare

1. **`src/components/docs/ChangelogSection.tsx`** — nessuna modifica codice; popolare la tabella DB `changelog` con ~25 entry retroattive (date plausibili gen-apr 2026, categorie `feature`/`improvement`/`bugfix`).

2. **`src/components/docs/ManualSections.tsx`** — aggiungere nuove sotto-sezioni:
   - `man-performance` (nuova): scheda performance, obiettivi, note Q
   - `man-approved-projects` (nuova): monitor progetti approvati, semaforo criticità
   - `man-hours-bank` (nuova): banca ore, previsionale, riporti
   - Estendere `man-budget` con: data chiusura attesa, link servizi post-creazione, alert progressivi
   - Estendere `man-preventivi` con: simulatore margine, multi-budget, FIC
   - Estendere `man-progetti` con: maggiorazioni timesheet, target 70%, progress automatico
   - Estendere `man-calendario` con: timesheet pubblica v3, multi-utente, ricorrenza
   - Estendere `man-workflows` con: dipendenze, commenti, scadenze individuali
   - Estendere `man-impostazioni` con: contratti dinamici, livelli/aree, External users, Slack, FIC, Sheet sync

3. **`src/components/docs/RolesPermissionsSection.tsx`** — aggiungere ruolo **External** alle descrizioni (la matrice resta auto-generata da `defaultPermissions`).

4. **`src/components/docs/AiAutomationsSection.tsx`** — aggiungere card su:
   - Notifiche progressive budget (50/75/90/100% + proiezione)
   - Promemoria pianificazione settimanale
   - Slack su 3 scenari
   - Webhook Make su completamento progetto

5. **`src/components/docs/FaqSection.tsx`** — aggiungere FAQ:
   - Come funzionano le schede performance?
   - Cos'è la banca ore e come si legge il previsionale?
   - Come si attivano le notifiche Slack/email?
   - Come funziona la simulazione ruolo?
   - Cosa significa "Progetto Approvato critico"?

6. **`src/components/docs/TroubleshootingSection.tsx`** — aggiungere:
   - "Non ricevo più notifiche email/in-app"
   - "Non vedo il mio progetto nel dialog Nuova attività" (filtro `aperto` + membership)
   - "Le ore della banca ore sembrano sbagliate" (logica Larin OFF, periodi contrattuali)
   - "Sync Google Sheet/HubSpot non aggiorna"

7. **`src/components/docs/docSections.ts`** — aggiungere nuove voci sidebar:
   - `man-performance`, `man-approved-projects`, `man-hours-bank` sotto "Manuale Dettagliato"

### Approccio per il changelog DB
Migration SQL singola che inserisce ~25 entry in `changelog` con date distribuite negli ultimi 4 mesi e categoria appropriata, così la pagina `🆕 Novità` mostra subito contenuti reali. Esempio righe:
- `2026-04-20` · feature · "Schede Performance Personali"
- `2026-04-17` · improvement · "Notifiche budget progressive 50/75/90/100%"
- `2026-04-15` · feature · "Pagina Progetti Approvati con monitor criticità"
- `2026-04-10` · improvement · "Filtro progetti aperti nel dialog Nuova attività"
- `2026-04-07` · feature · "Banca Ore con previsionale mensile"
- `2026-03-30` · feature · "Workflows v2: dipendenze e commenti"
- `2026-03-24` · feature · "Ruolo External per collaboratori esterni"
- `2026-03-17` · improvement · "Riepilogo settimanale AI via email"
- `2026-03-12` · feature · "Maggiorazioni timesheet per utente/categoria"
- `2026-03-10` · feature · "Simulatore margine bidirezionale nei preventivi"
- `2026-02-27` · feature · "Integrazione Fatture in Cloud (OAuth)"
- ...e altre per coprire ~4 mesi

### Risultato atteso
- Sidebar `/help` aggiornata con 3 nuove voci nel "Manuale Dettagliato"
- Sezione "🆕 Novità" popolata con timeline degli ultimi rilasci
- Tutte le funzionalità rilasciate negli ultimi mesi documentate con istruzioni d'uso
- FAQ e Troubleshooting allineate ai casi più recenti segnalati

### Nessuna modifica
- Codice di routing, permessi, o logica DB
- Componenti UI esistenti fuori da `/docs/*`

