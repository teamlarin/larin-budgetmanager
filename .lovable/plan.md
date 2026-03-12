

# Documentazione Completa TimeTrap

## Approccio

Riscrittura completa di `src/pages/Help.tsx` con:
- **Layout a 2 colonne**: sidebar di navigazione sticky (sinistra) + contenuto scrollabile (destra)
- **Mobile**: sidebar diventa select/dropdown in cima
- **Navigazione**: smooth scroll tramite `id` sulle sezioni
- **Permessi semi-dinamici**: la tabella ruoli/permessi legge da `src/lib/permissions.ts` (defaultPermissions) per essere sempre allineata al codice

## Struttura contenuti

### Quick Start
1. Primo accesso e approvazione account
2. Panoramica interfaccia (screenshot-like description per ruolo)
3. Creare il primo budget, generare preventivo, approvare progetto
4. Pianificare attività nel calendario

### Manuale Dettagliato
- **Dashboard**: dashboard per ruolo, KPI, AI Insights
- **Budget**: creazione (manuale/template/import), voci, Gantt, stati, drag-and-drop
- **Preventivi**: generazione PDF, margini, sconti, IVA, split pagamento
- **Progetti**: conversione budget->progetto, Canvas, timesheet, costi aggiuntivi, audit log
- **Calendario e Timesheet**: pianificazione, Google Calendar, vista multi-utente, timesheet pubblica
- **Workload**: analisi carico, ore contrattuali vs pianificate
- **Workflows**: flussi e template
- **Impostazioni**: utenti, clienti, prodotti, servizi, livelli, categorie, integrazioni (HubSpot, Google Calendar, Google Sheets, Fatture in Cloud)

### Ruoli e Permessi
- Tabella comparativa generata da `defaultPermissions` in `permissions.ts`
- Descrizione di ogni ruolo e simulazione ruoli

### AI e Automazioni
- Chat AI, AI Insights Panel, Riepilogo settimanale

### Best Practices
- Struttura budget, naming, gestione margini, pianificazione team

### FAQ (espansione delle attuali + nuove)

### Troubleshooting
- Accesso, sincronizzazione, errori preventivi, dati mancanti

## Implementazione tecnica

**File modificato**: `src/pages/Help.tsx`

- Componente interno `DocSidebar` con lista sezioni, highlight della sezione attiva tramite `IntersectionObserver`
- Su mobile (`useIsMobile()`): sidebar diventa un `Select` in cima alla pagina
- Ogni sezione è un blocco con `id` e `scroll-margin-top`
- Tabella permessi usa componente `Table` di shadcn, dati da `defaultPermissions`
- Accordion per sotto-sezioni e FAQ
- Video guide esistenti mantenute
- Footer con link Slack mantenuto

Stima: ~1800 righe, file singolo con sezioni ben organizzate.

