

## Fix workflow GitHub Actions "Auto Changelog"

Il job fallisce nello step shell prima ancora di chiamare la edge function (i log Supabase confermano: nessuna invocazione registrata). La causa è l'interpolazione diretta di `${{ toJson(github.event.commits) }}` racchiusa tra apici singoli nello script bash: se un messaggio di commit contiene un apice singolo, un backtick, una `$` o caratteri di escape particolari, la shell non riesce a parsare e `jq` esce con errore → "All jobs have failed".

### Soluzione

Riscrivo `.github/workflows/changelog.yml` passando il payload dei commit a `jq` tramite **variabile d'ambiente** invece che tramite interpolazione shell. Pattern raccomandato da GitHub per evitare script injection e problemi di quoting.

### Cosa cambia in `changelog.yml`

1. Sposto `github.event.commits` in una env var dedicata (`COMMITS_RAW`) sullo step, così GitHub Actions la inietta in modo sicuro.
2. Uso `jq` con `--argjson commits "$COMMITS_RAW"` (o leggendo da `$COMMITS_RAW` con `echo`/here-string) senza apici singoli attorno all'espressione `${{ }}`.
3. Stesso trattamento per `github.ref` e `github.ref_name` (li sposto in env var per evitare injection).
4. Aggiungo `set -euo pipefail` in cima allo script così, in caso di nuovo fallimento, il log mostra il punto esatto.
5. Aggiungo un fallback: se `commits` è `null` o vuoto (push di tag senza commit, force-push), esce con successo senza chiamare la function.
6. Aggiungo `--fail-with-body` a curl e controllo dello status code: se la edge function risponde non-2xx, il job fallisce esplicitamente con il body dell'errore visibile nei log (così la prossima volta vediamo subito la causa).

### File toccati

- `.github/workflows/changelog.yml` — refactor dello step

Nessuna modifica all'edge function `changelog-from-commits` (è già corretta) né a secrets, DB o RLS. I secrets `SUPABASE_URL` e `CHANGELOG_WEBHOOK_SECRET` su GitHub restano invariati.

### Note

- Se anche dopo il fix il job dovesse fallire, il nuovo logging stamperà esattamente lo status HTTP e il body della risposta della edge function — rendendo banale la diagnosi successiva.
- Non riesco a leggere i log di GitHub Actions direttamente (non ho accesso al tuo repo GitHub da qui): se dopo il deploy il problema persiste, incollami l'output dello step fallito e affino il fix.

