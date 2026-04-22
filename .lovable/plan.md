

## Guida `/help` scaricabile + migliorie UX

### 1. Download della guida (PDF + Markdown)

**Nuovo file:** `src/lib/exportDocsToPdf.ts`
**Nuovo file:** `src/lib/exportDocsToMarkdown.ts`
**Modifica:** `src/pages/Help.tsx` (bottone "Scarica guida" nell'header sticky)

Approccio scelto: **export "live"** dal DOM già renderizzato della pagina `/help`, così resta sempre allineato ai contenuti reali senza dover mantenere una copia parallela.

- **PDF**: usa `html2canvas` (già richiamato in `generatePdfQuote.ts`) + `jspdf` per catturare il `<main>` della guida sezione per sezione (uno screenshot per ogni `<section id="...">`), unendo le pagine con titolo, indice cliccabile e numerazione. Tutti gli `<Accordion>` vengono espansi temporaneamente prima dello scatto e richiusi dopo.
- **Markdown**: walker DOM che converte heading, paragrafi, liste, tabelle e accordion in `.md` ben formattato. Più leggero, ideale per condividere su Slack/Notion.
- Dropdown "Scarica" con due voci: `📄 PDF (completa)` e `📝 Markdown`.
- Nome file: `TimeTrap-Guida_yyyy-MM-dd.pdf` / `.md`.
- Spinner + toast di conferma; gestione errore con fallback al solo Markdown se html2canvas fallisce.

### 2. Stampa-friendly (`@media print`)

**Modifica:** `src/index.css`

Regole `@media print` dedicate alla pagina `/help`:
- Nasconde sidebar, header app, search bar, chatbot, bottoni feedback.
- Espande tutti gli `<Accordion>` (forza `data-state="open"`).
- `page-break-inside: avoid` su `Card`, `page-break-before: always` sui titoli `h2` principali.
- Colori semplificati (no gradients, bordi sottili) per inchiostro.

Così l'utente può anche fare semplicemente `Cmd/Ctrl+P` e ottenere un PDF pulito dal browser, in alternativa al download generato.

### 3. Altri suggerimenti di miglioramento (inclusi nel piano)

**a) Indicatore "Ultimo aggiornamento per sezione"**
- Aggiungere campo opzionale `updatedAt` a `docSections.ts` e mostrare un badge piccolo `Aggiornato il 22/04/2026` accanto al titolo delle sezioni modificate negli ultimi 30 giorni.

**b) Reading progress bar**
- Barra sottile (h-1) in cima alla pagina che cresce con lo scroll del `<main>`, dà senso di lunghezza.

**c) Bottone "Copia link sezione"**
- Icona `Link2` accanto a ogni `<h2>`/`<h3>`: copia `window.location.origin + /help#id` negli appunti + toast. Utile per condividere puntuale su Slack.

**d) Tabella dei contenuti compatta in cima**
- Sotto la card "Cos'è TimeTrap?" un mini-TOC orizzontale con i 6 link principali (Quick Start, Manuale, Ruoli, AI, FAQ, Troubleshooting) come chips, per chi non ha la sidebar (mobile).

**e) Stato vuoto della ricerca migliorato**
- Quando una ricerca non trova nulla, oltre al "Chiedi all'AI" mostriamo i 3 suggerimenti più cliccati (top 3 da `help_feedback` con `helpful=true`, query letta da `entity_id`). Migliora discoverability nel tempo.

**f) "Hai trovato utile questa sezione?" inline**
- `FeedbackButtons` (già esistente, source=`'doc_section'`) in fondo a ogni `<section>` del Manuale, non solo via search. Più segnale per capire quali sezioni riscrivere.

### File modificati / creati

**Nuovi**
- `src/lib/exportDocsToPdf.ts` — export PDF multi-pagina con TOC
- `src/lib/exportDocsToMarkdown.ts` — DOM → Markdown
- `src/components/docs/SectionAnchor.tsx` — wrapper riusabile con bottone "copia link"
- `src/components/docs/ReadingProgress.tsx` — barra di scroll
- `src/components/docs/CompactToc.tsx` — TOC orizzontale a chips

**Modificati**
- `src/pages/Help.tsx` — dropdown download, reading progress, mini-TOC, feedback inline su sezioni Manuale
- `src/index.css` — regole `@media print` per la guida
- `src/components/docs/docSections.ts` — campo opzionale `updatedAt`
- `src/components/docs/DocSearch.tsx` — empty state arricchito con top suggerimenti
- `src/components/docs/ManualSections.tsx`, `QuickStartSection.tsx`, ecc. — wrap dei titoli `<h2>` con `SectionAnchor`

### Dipendenze

Già presenti nel progetto: `jspdf`, `html2canvas` (usati da `generatePdfQuote.ts`). Nessuna nuova dipendenza necessaria.

### Risultato

- L'utente può scaricare la guida in PDF (completa, impaginata, con indice) o in Markdown con un clic.
- Stampa nativa pulita via `Cmd+P` per chi preferisce.
- Navigazione e condivisione più rapide grazie a link diretti per sezione, mini-TOC e barra di progresso.
- Più dati di feedback granulari per capire dove migliorare i contenuti.

