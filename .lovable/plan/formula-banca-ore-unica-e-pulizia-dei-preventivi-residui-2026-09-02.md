# Formula Banca Ore unica e pulizia dei "Preventivi" residui

## 1. Una sola formula per la Banca Ore

Verificato nel codice (`ProfileHoursBank.tsx`): il saldo è `(confermate + rettifiche) − attese − ore recuperate` (dove le "ore recuperate" sono le attività di banca ore su Larin OFF). Le tre versioni scritte in giro non coincidono, quindi si allineano tutte a questa, usando sempre il termine **ore attese** (mai "pianificate", che nella app significa ore pianificate a calendario).

Testo canonico da usare in tutti i punti:

```text
Saldo = (ore confermate + rettifiche) − ore attese − ore recuperate
```

- **ore confermate**: tempo confermato nel periodo (incluse le attività Larin OFF e di banca ore)
- **rettifiche**: correzioni manuali mensili (+/−) inserite dall'admin
- **ore attese**: ore dovute da contratto e periodi contrattuali, al netto delle chiusure aziendali
- **ore recuperate**: ore già prese come recupero banca ore

Dove intervenire:
- **Manuale, sezione Banca Ore** (`ManualSections.tsx`, formula + elenco voci): sostituire "ore pianificate" con "ore attese", aggiungere la voce "rettifiche" e chiarire nella nota del previsionale che lì si parla di ore *pianificate a calendario* nei giorni restanti — sono due cose diverse e va detto esplicitamente.
- **FAQ Banca Ore** (`FaqSection.tsx`): reintrodurre le rettifiche nella formula, identica a quella del manuale.
- **Knowledge base AI** (`supabase/functions/ai-agent/index.ts`, voce BANCA ORE): riscrivere la formula completa con le quattro componenti e il chiarimento attese ≠ pianificate.

## 2. Rimozione dei "Preventivi" residui

- **Panoramica interfaccia** (`QuickStartSection.tsx`): aggiornare i menu per ruolo — Admin/Account/Finance senza "Preventivi", con **Finanza** (Cruscotto, Offerte, Gare, Fatture, Abbonamenti, Costo personale) visibile solo ad admin/account/finance; Finance senza "Dashboard Finance" (rimossa) e con Costo personale. Nel workflow del primo budget togliere "Genera Preventivo" e "preventivo PDF": il budget approvato genera un'**offerta in bozza** e il progetto.
- **Ruoli e Permessi** (`RolesPermissionsSection.tsx`): nelle descrizioni di Account e Finance sostituire "preventivi" con "offerte"; per Coordinator togliere i "servizi" dal catalogo (dismessi).
- **FAQ**: nella domanda sull'export sostituire "Preventivi: genera PDF" con "Offerte: PDF pubblico e link firma"; nella FAQ sui budget approvati parlare di variante per una nuova offerta; nella FAQ margini usare "totale dell'offerta accettata".
- **Manuale, punti residui**: dashboard Account/Finance e "Fatturato previsto" → offerte accettate; nota sull'ordinamento attività → "si riflette nell'offerta"; termini di pagamento → "usati nelle offerte".
- **Knowledge base AI**: eliminare la voce `PREVENTIVI (#man-preventivi)` con il modello multi-budget/`quote_budgets`, e aggiungere `OFFERTE (#man-offerte)` (documento unico versionato, titolo e numero editabili, righe prodotto con titolo/descrizione modificabili e categoria di ricavo dal prodotto, esito manuale, link pubblico con firma, PDF, invio a Fatture in Cloud, generazione automatica progetto + cartella Drive all'accettazione) più `FINANZA (#man-finanza)` e `TASK DI PROGETTO (#man-task)`, che oggi mancano. Aggiornare anche BUDGET (solo prodotti, niente servizi, offerta in bozza automatica) e i ruoli (Finance senza dashboard dedicata, Coordinator senza servizi).

## 3. Coerenza indice e ricerca

Aggiornare `docSearchIndex.ts` dove serve, così che una ricerca "preventivo" porti su **Offerte** e "banca ore" mostri lo snippet con la formula corretta. Verificare che nessuna voce puntí più a `#man-preventivi`.

## Note tecniche

File toccati: `src/components/docs/ManualSections.tsx`, `FaqSection.tsx`, `QuickStartSection.tsx`, `RolesPermissionsSection.tsx`, `docSearchIndex.ts`, `supabase/functions/ai-agent/index.ts` (redeploy della function). Solo contenuti testuali: nessuna modifica alla logica di calcolo della banca ore né al database.
