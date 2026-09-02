# Aggiornare guida e Novità in /help

La sezione Novità mostra voci fino al **29 aprile 2026** (verificato: nessun record nel changelog dopo quella data) e il manuale descrive ancora funzioni superate (Preventivi, Servizi, vecchio Calendario). Da maggio a settembre sono state rilasciate molte funzionalità non documentate.

## 1. Backfill delle Novità (maggio - settembre 2026)

Inserimento manuale nel changelog delle release mancanti, raggruppate per mese, con categoria (Novità / Miglioramento / Correzione):

- **Task di progetto**: task con scadenze, priorità, stati, assegnatari multipli, descrizione rich-text con immagini, ricorrenze, drag & drop, collegamento obbligatorio all'attività prevista, widget "Le mie task", CTA rapida nell'header.
- **Calendario e Planner**: nuova vista Planner settimanale, pianificazione via drag & drop dalla sidebar, spostamento attività tra settimane, conferma ore dal Planner, riepilogo per progetto (pianificate totali / pianificate settimana / confermate settimana), task nel calendario, controllo conflitti e sincronizzazione realtime.
- **Finanza**: nuovo menu Finanza (Cruscotto, Offerte, Gare, Fatture, Abbonamenti, Costo personale) visibile solo ad admin/account/finance.
- **Offerte**: consolidamento Preventivi → Offerte, titolo e numero modificabili, esito manuale, righe prodotto con titolo/descrizione editabili e categoria di ricavo, ricerca prodotto, generazione automatica del progetto e della cartella Drive all'accettazione, numero offerta riportato sul progetto.
- **Prodotti**: solo prodotti allineati a Fatture in Cloud, sincronizzazione notturna del listino, servizi dismessi.
- **Integrazioni e AI**: API pubblica TimeTrap, server MCP per Claude, assistente AI con fonti, modelli AI aggiornati.
- **Altro**: report Slack settimanale ore per team, profilo utente esteso, cliente facoltativo sulle attività dei progetti interni, aree progetto normalizzate, hardening sicurezza, ordinamento utenti per cognome.

## 2. Aggiornamento del manuale

- Sostituire la sezione **Preventivi** con **Offerte** (versioni, firma, esito manuale, righe prodotto, PDF pubblico, Fatture in Cloud) e aggiungere una sezione **Finanza** (cruscotto, fatture, abbonamenti, gare, costo personale).
- Aggiungere **Task di progetto** come nuova sezione del manuale.
- Aggiornare **Calendario e Timesheet** con Planner settimanale, drag & drop, conferma ore e task.
- Aggiornare **Budget** (solo prodotti, niente "genera preventivo", offerta in bozza automatica) e **Progetti** (task, numero offerta, progresso pack).
- Aggiungere **API e MCP** dentro AI e Automazioni.
- Aggiornare FAQ e Troubleshooting con le domande nuove (offerta non modificabile, prodotto non trovato, task senza attività, planner e conflitti).
- Allineare indice laterale, indice compatto e ricerca alle nuove sezioni, con date "aggiornato al" a settembre 2026.

## 3. Automazione changelog

Verifica del flusso GitHub Actions → edge function `changelog-from-commits` per capire perché non arrivano più voci (probabile secret o workflow non eseguito) e documentazione dell'esito. Se il problema è lato GitHub, indicherò cosa configurare senza modificare il repository esterno.

## Note tecniche

- Novità: insert nella tabella `changelog` (title, description, category, created_at datati al mese reale).
- Manuale: modifiche a `ManualSections.tsx`, `FaqSection.tsx`, `TroubleshootingSection.tsx`, `AiAutomationsSection.tsx`, `RolesPermissionsSection.tsx`, più `docSections.ts` e `docSearchIndex.ts` per indice e ricerca.
- Nessuna modifica alla logica applicativa: solo contenuti documentali e dati changelog.
