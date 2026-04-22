

## Migliorie pagina `/help`: changelog mensile, ricerca, integrazione chatbot

### 1. Changelog raggruppato per mese (con collassamento)

**File:** `src/components/docs/ChangelogSection.tsx`

- Raggruppare le entry `changelog` per mese (chiave `yyyy-MM`).
- Il mese più recente resta **espanso** di default; tutti gli altri mesi sono in un `<Collapsible>` chiuso con header cliccabile (`Aprile 2026 (12)`, `Marzo 2026 (8)`, …).
- Ordinamento mesi decrescente, entry interne decrescenti per data.
- Usare il componente `Collapsible` già presente in `src/components/ui/collapsible.tsx`.

```text
Aprile 2026 (12)         [espanso]
  • 22/04 · feature · Schede Performance
  • 20/04 · improvement · Notifiche progressive
Marzo 2026 (8)           [chiuso ▸]
Febbraio 2026 (5)        [chiuso ▸]
```

### 2. Ricerca testuale nella guida

**Nuovo file:** `src/components/docs/DocSearch.tsx`
**Modificato:** `src/pages/Help.tsx` (header) e `src/components/docs/docSections.ts` (estensione con campo `keywords`/`content` per indicizzazione)

- Input di ricerca in cima alla pagina (sotto il titolo, sticky con backdrop blur).
- Indice statico costruito da `docSections` + un nuovo array `docSearchIndex` con titolo, parole chiave e snippet di ogni sezione/sottosezione (Quick Start, Manuale, FAQ, Troubleshooting, Best Practices, AI/Automazioni, Ruoli).
- Match case-insensitive su titolo + keywords + snippet.
- Risultati in dropdown sotto l'input: clic → `scrollIntoView` sulla sezione + highlight temporaneo (classe `bg-primary/10` per 1.5s).
- Tasto `Esc` chiude i risultati; `↑/↓` navigazione, `Enter` selezione.
- Nessun match → "Nessun risultato. Prova a chiedere all'assistente AI" con bottone che apre `AiChatWidget`.

### 3. Chatbot esteso alle FAQ della guida

**File:** `supabase/functions/ai-agent/index.ts` (già esistente, da estendere il system prompt)
**File:** `src/components/AiChatWidget.tsx` (suggerimenti iniziali)

L'assistente AI oggi risponde su dati operativi (progetti, ore, budget) interrogando il DB. Per rispondere anche su **come si usa la piattaforma**:

- Aggiungere al system prompt dell'edge function `ai-agent` una **knowledge base inline** sintetica con i punti chiave della guida (sezioni Manuale, FAQ, Troubleshooting, Ruoli, Best Practices). Circa 3-4KB di testo compresso che copre:
  - Cosa sono budget, preventivi, progetti, calendario, workload, workflows, performance, banca ore
  - Come funzionano i ruoli (Admin, Account, Team Leader, Coordinator, Member, External)
  - FAQ principali e troubleshooting
- Istruire il modello a distinguere fra: (a) domanda operativa sui dati → query SQL, (b) domanda "come funziona X" → risposta dalla knowledge base con link alla sezione `/help#<id>`.
- Aggiungere prompt suggeriti nel widget: "Come creo un budget?", "Cos'è la banca ore?", "Come funzionano i workflows?".

### 4. Bottone "Chiedi all'AI" nella pagina

**File:** `src/pages/Help.tsx`

- In cima alla pagina, accanto alla barra di ricerca, un bottone secondario "💬 Chiedi all'assistente" che apre `AiChatWidget` con stato `open=true`.
- Per farlo serve esporre lo stato del widget: trasformare `AiChatWidget` in modo che possa essere aperto da un evento globale (custom event `open-ai-chat`) o da un mini context. Approccio scelto: **custom event** (zero refactor di provider).
  - `Help.tsx` dispatcha `window.dispatchEvent(new Event('open-ai-chat'))`
  - `AiChatWidget` ascolta e setta `open=true`

### File modificati

- `src/components/docs/ChangelogSection.tsx` — raggruppamento mensile + collassamento
- `src/components/docs/DocSearch.tsx` — **nuovo**, barra di ricerca + dropdown risultati
- `src/components/docs/docSearchIndex.ts` — **nuovo**, indice statico (titolo, id, keywords, snippet)
- `src/pages/Help.tsx` — barra ricerca + bottone "Chiedi all'AI"
- `src/components/AiChatWidget.tsx` — listener `open-ai-chat` + nuovi prompt suggeriti sulla guida
- `supabase/functions/ai-agent/index.ts` — system prompt esteso con knowledge base della guida

### Risultato

- Changelog leggibile: solo l'ultimo mese aperto, gli altri compatti e collassabili.
- Ricerca veloce dentro la guida con scroll automatico al risultato.
- Chatbot risponde sia sui dati sia sul "come usare TimeTrap", con link diretti alla sezione corrispondente di `/help`.
- Da qualsiasi punto della guida l'utente può aprire il chatbot con un clic.

