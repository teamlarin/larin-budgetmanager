
## Fix definitivo workflow GitHub "Auto Changelog"

L’errore attuale non è più dovuto ai commit: il job si rompe perché `curl` riceve un URL senza host, quindi in GitHub Actions `SUPABASE_URL` sta arrivando vuoto o non impostato.

### Diagnosi confermata

- Nel workflow attuale (`.github/workflows/changelog.yml`) la chiamata è:
  ```bash
  "${SUPABASE_URL}/functions/v1/changelog-from-commits"
  ```
- L’errore:
  ```text
  curl: (3) URL rejected: No host part in the URL
  ```
  significa che `SUPABASE_URL=""`.
- I log della edge function `changelog-from-commits` risultano vuoti, quindi la request non arriva proprio a Supabase.
- Nel progetto è già presente l’URL Supabase corretto:
  ```ts
  https://dmwyqyqaseyuybqfawvk.supabase.co
  ```
  (`src/integrations/supabase/client.ts`)

## Intervento previsto

### 1. Rendere il workflow indipendente dal secret `SUPABASE_URL`
Aggiorno `.github/workflows/changelog.yml` per costruire un endpoint valido anche se il secret GitHub manca.

Approccio:
- continuo a leggere `secrets.SUPABASE_URL` se presente
- se è vuoto, faccio fallback all’URL progetto noto:
  ```text
  https://dmwyqyqaseyuybqfawvk.supabase.co
  ```
- compongo poi:
  ```text
  $BASE_URL/functions/v1/changelog-from-commits
  ```

In pratica:
```bash
BASE_URL="${SUPABASE_URL:-https://dmwyqyqaseyuybqfawvk.supabase.co}"
FUNCTION_URL="${BASE_URL%/}/functions/v1/changelog-from-commits"
```

### 2. Aggiungere un check esplicito prima del `curl`
Inserisco una guardia che fallisce con messaggio chiaro se l’URL finale non è valido, così in futuro l’errore sarà leggibile subito nei log.

Esempio:
```bash
if [ -z "$BASE_URL" ] || ! printf '%s' "$BASE_URL" | grep -Eq '^https?://'; then
  echo "Invalid Supabase base URL"
  exit 1
fi
```

### 3. Loggare l’endpoint usato in forma sicura
Stampo nei log solo l’host/base URL scelto, non i secret, così si capisce subito se il workflow sta usando:
- il secret GitHub
- oppure il fallback hardcoded

### 4. Lasciare invariata la edge function
Non tocco `supabase/functions/changelog-from-commits/index.ts`, perché il problema è a monte nel workflow, non nel backend.

## File coinvolti

- `.github/workflows/changelog.yml`

## Risultato atteso

Dopo il fix:
- il job non dipenderà più dal secret `SUPABASE_URL` per funzionare
- la chiamata raggiungerà davvero la edge function
- se `CHANGELOG_WEBHOOK_SECRET` fosse errato, vedremo finalmente un vero HTTP status (401/500 ecc.) invece dell’errore `curl: (3)`

## Nota tecnica

`SUPABASE_URL` non è un segreto sensibile: è l’URL pubblico del progetto Supabase. Per questo è sicuro usare un fallback esplicito nel workflow, mentre il secret sensibile da mantenere solo in GitHub resta `CHANGELOG_WEBHOOK_SECRET`.
