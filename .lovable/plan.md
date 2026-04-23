

## Auto-associazione canali Slack ai progetti

Aggiungo uno strumento di matching automatico che propone, per ogni progetto senza canale Slack collegato, il canale più probabile basato su nome cliente + parole chiave del progetto. L'admin conferma una per una (o in batch).

### Come funziona il matching

Per ogni progetto senza `slack_channel_id`:

1. Normalizzo nome cliente e nome progetto (lowercase, rimuovo `s.r.l.`, `s.p.a.`, `srl`, `spa`, accenti, punteggiatura, parole stop tipo "assistenza", "manutenzione", "2026", "lavorazioni", numeri di giornate).
2. Estraggo token significativi (cliente + 2-3 keyword del progetto, es. "nims", "landing", "vendita").
3. Per ogni canale Slack normalizzato (lowercase, `_`/`-` → spazi), calcolo uno score:
   - **+10** se il nome cliente normalizzato è contenuto nel nome canale (match forte).
   - **+5** per ogni token cliente significativo presente.
   - **+3** per ogni keyword del progetto presente (sito, web, app, social, marketing, landing, video, formazione, intranet, ecc.).
   - **+2** se il `project_type` matcha (es. "landing" → canale con "landing").
   - **−5** se il canale contiene parole "rumore" tipo `general`, `random`, `team-`, `internal`, `tt-`.
4. Tengo i top 3 candidati per progetto, contrassegnando come:
   - **alta confidenza** (score ≥ 12 e gap > 4 dal secondo) → preselezionato
   - **media confidenza** (score 6-11) → da rivedere
   - **nessun match** (score < 6) → vuoto

### Nuova UI: dialog "Auto-associa canali Slack"

Pulsante in **Settings → Integrazioni** (sezione Slack) e in **Progetti Approvati** (header), visibile solo a admin/team_leader/account/coordinator.

```text
┌─ Auto-associa canali Slack ────────────────────────────┐
│  207 progetti senza canale · 412 canali Slack          │
│  [Filtri: ☑ alta ☑ media ☐ nessun match]              │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ ✓ Nims - Landing page di vendita                │  │
│  │   Cliente: Nims S.p.A                           │  │
│  │   → #nims-landing-vendita     [alta · 18]   ▼   │  │
│  │   Alternative: #nims-mynims (12), #nims-app (8) │  │
│  └─────────────────────────────────────────────────┘  │
│  ┌─────────────────────────────────────────────────┐  │
│  │ ☐ Marchon - Video AI 4 brand                    │  │
│  │   → #marchon-video-ai          [media · 9]  ▼   │  │
│  └─────────────────────────────────────────────────┘  │
│  ...                                                    │
│  [Salta tutti i "media"] [Conferma selezionati (47)]   │
└─────────────────────────────────────────────────────────┘
```

Per ogni riga:
- Checkbox per includere/escludere dal salvataggio batch
- Dropdown con i 3 candidati + opzione "altro canale…" (apre il picker esistente)
- Badge confidenza (alta/media/nessun) con score
- Click su "Conferma selezionati" → update batch su `projects.slack_channel_id` + `slack_channel_name`

### Architettura tecnica

**Nuova edge function** `suggest-slack-channels-for-projects`
- Auth: solo admin/team_leader/account/coordinator (stesso pattern di `list-slack-channels`).
- Step 1: legge tutti i progetti `status='approvato'` AND `project_status != 'completato'` AND `slack_channel_id IS NULL`, joina `clients(name)`.
- Step 2: scarica tutti i canali Slack via `conversations.list` (paginata, riusa la logica di `list-slack-channels`).
- Step 3: normalizza ed esegue il matching scoring lato server (deterministico, no AI → veloce e prevedibile).
- Risposta: `[{ project_id, project_name, client_name, candidates: [{channel_id, channel_name, score, confidence}] }]`.

**Salvataggio**: client-side, una `update` Supabase per progetto (chunk di 20 in parallelo). RLS esistente già limita la modifica ai ruoli giusti.

**Nessuna modifica DB/RLS/schema.**

### File toccati

- `supabase/functions/suggest-slack-channels-for-projects/index.ts` — nuova
- `src/components/SlackChannelAutoMatchDialog.tsx` — nuovo (dialog con tabella candidati)
- `src/components/IntegrationsTab.tsx` — pulsante "Auto-associa canali Slack"
- `src/pages/ApprovedProjects.tsx` — pulsante nell'header per accesso rapido

### Note

- Matching deterministico basato su regole, non AI: zero costi, risultati riproducibili, debug facile.
- Se il livello di confidenza non basta, posso aggiungere come opzione una seconda passata via Lovable AI Gateway (Gemini Flash, gratis fino al 6 ottobre) che giudica i match "media" — dimmi se lo vuoi e lo includo.
- Nessun salvataggio automatico senza conferma utente, come richiesto.

