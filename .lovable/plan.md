

## Diagnosi: perché `generate-slack-progress-drafts-thursday` è lenta

Ho letto l'edge function e contato i progetti reali in DB. Ecco i numeri:

- **208 progetti approvati** non completati passano il filtro di eleggibilità
- **133** hanno canale Slack, **58** hanno cartella Drive del progetto, **208** hanno cliente (quindi vengono provati anche Drive cliente + Gmail)
- Il loop su `eligibleProjects` è **sequenziale** (un `for` puro), non parallelo

Per ogni progetto la funzione fa, in ordine:

1. 2 query Supabase (`existingUpdate`, `existingDraft`) + opzionale `client_contacts`
2. **3 fetch in parallelo** verso API esterne (Slack history, Drive list+export, Gmail list+detail)
3. **1 chiamata AI** a Gemini 2.5 Flash con prompt potenzialmente grosso (fino a 6000 char per trascrizione × 5 + 25 email + 30 messaggi Slack)
4. 1 insert draft + 1 insert notification

### I veri colli di bottiglia

**A. Drive: ricorsione in sottocartelle profonda 2 livelli, sequenziale**
`listDriveDocsInFolder` (riga 126) ricorre nei sottofolder **uno alla volta** con `await`. Se un cliente ha 10 sottocartelle, sono 10 round-trip seriali per progetto. Poi `exportDriveDocAsText` esporta ogni doc candidato **uno alla volta** (riga 260). Su clienti con Drive grossi (es. Larin, Latemar) questo è il principale assassino.

**B. Gmail: N+1 di fatto**
`fetchGmailMessages` lista fino a 25 messaggi e poi fa **una richiesta dettaglio per ognuno in serie** (riga 338-353). Sono fino a 26 round-trip Gmail per progetto, sequenziali.

**C. Slack: paginazione sequenziale**
Fino a 5 pagine da 200 messaggi, una alla volta. Sui canali rumorosi sono 5 round-trip per progetto.

**D. AI prompt grande = latenza Gemini alta**
Con 5 trascrizioni × 6KB + 25 email + 30 Slack il prompt arriva facilmente a 30-40KB → Gemini 2.5 Flash impiega 4-10s a progetto, anche di più sotto contention.

**E. Loop progetti SERIALE**
Il `for (const project of eligibleProjects)` non parallelizza nulla. Anche ipotizzando 3-5s a progetto in media (best case), 208 × 4s ≈ **14 minuti**. In caso di Drive grossi facilmente arriva a 25-30 min e rischia di sfondare il timeout edge function (150s wall-clock per i cron asincroni di pg_net non blocca, ma la funzione viene comunque killata dopo ~150-400s a seconda del piano).

### Conferma indiretta nei log

I log della function sono vuoti (`No logs found`) perché le ultime esecuzioni hanno risposto 401 (vault vuoto, non hanno mai eseguito davvero il body). Una volta sistemato il vault, la lentezza emergerà chiaramente.

---

## Piano di ottimizzazione

Tre interventi indipendenti, ordinati per ROI.

### 1. Parallelizzare il loop progetti con concurrency controllata (ROI altissimo)

Sostituire il `for` seriale con un esecutore in **batch da 8 progetti in parallelo** (semaforo manuale). Questo da solo porta 14 min → ~2 min nel caso medio. 8 è un buon compromesso per non saturare i rate limit di Slack/Drive/Gmail/AI.

### 2. Parallelizzare le chiamate Drive interne (ROI alto su clienti grossi)

- `listDriveDocsInFolder`: lanciare la ricorsione nei sottofolder con `Promise.all` invece che `for await`
- `fetchDriveTranscripts`: esportare i doc candidati con `Promise.all` (max 5 in parallelo, già limitato dal `slice(0, maxTranscripts)`)
- Aggiungere **early-exit**: se ho già 5 trascrizioni candidate da una folder, non scendere nelle altre

### 3. Parallelizzare i dettagli Gmail (ROI medio)

`fetchGmailMessages`: dopo la `list`, fare i 25 dettagli con `Promise.all` (Gmail API regge bene 25 richieste concorrenti per utente).

### 4. Ridurre prompt AI (ROI medio sulla latenza Gemini)

- Trascrizioni: passare da `slice(0, 6000)` per trascrizione a un troncamento più aggressivo (3000 char) e max 3 trascrizioni invece di 5
- Email: 15 invece di 25
- Slack: 20 invece di 30

L'output rimane di qualità (sono progress update di 3-5 frasi, non riassunti enciclopedici) e il TTFB di Gemini scende del 30-40%.

### 5. Timeout difensivo per fetch esterne (sicurezza)

Wrappare tutte le `fetch` esterne (Slack/Drive/Gmail) con un timeout di **15s** via `AbortController`. Oggi una singola API che pende 30s blocca l'intero progetto. Con il timeout, peggio che vada quel progetto skippa quella fonte e prosegue.

### 6. Log di telemetria per misurare il prima/dopo

Aggiungere un `console.log` per progetto con: `project_id, durata_ms, slack_ms, drive_ms, gmail_ms, ai_ms, signals`. Così alla prossima esecuzione vediamo dove sta il tempo reale e possiamo iterare con dati veri.

---

## Cosa NON tocco

- Logica di eleggibilità progetti (non è il problema)
- Schema DB e tabella `project_update_drafts`
- UI del Monitor Sistema e dei draft
- Schedule del cron (giovedì 12:00 IT resta)
- Vault / CRON_SECRET (problema separato, già sistemato col bottone "Sincronizza")

## Riepilogo tecnico

- File modificato: `supabase/functions/generate-slack-progress-drafts/index.ts`
- Aggiungo helper `pMapWithConcurrency<T,R>(items, limit, fn)` e `fetchWithTimeout(url, opts, ms)`
- Refactor `listDriveDocsInFolder` (ricorsione parallela), `fetchDriveTranscripts` (export parallelo + cap 3), `fetchGmailMessages` (dettagli paralleli + cap 15), handler principale (loop parallelo cap 8)
- Riduzione costanti: trascrizioni 5→3, char/trascrizione 6000→3000, email 25→15, slack 30→20
- Telemetria per-progetto + telemetria aggregata finale (totalDurationMs, avgPerProjectMs)

**Atteso post-fix**: tempo totale da ~15-25 min a ~2-4 min, ben dentro qualunque timeout edge.

