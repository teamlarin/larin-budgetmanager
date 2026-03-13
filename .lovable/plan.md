

# Changelog automatico da CI/CD

## Panoramica

Creeremo un sistema che genera automaticamente entry nel changelog quando vengono pushati commit al repository GitHub. Il flusso:

```text
GitHub Push → GitHub Actions Workflow → Edge Function → Tabella changelog
```

## Componenti

### 1. Edge Function `changelog-from-commits`
Riceve i dati dei commit (titolo, descrizione, autore) via POST e inserisce le entry nella tabella `changelog`. Supporta due modalità:
- **Diretta**: parsing dei commit messages con convenzione (es. `feat:`, `fix:`, `perf:`) per determinare la categoria
- **AI-enhanced** (opzionale): usa l'API Lovable/OpenAI per generare titolo e descrizione user-friendly dal diff

Mapping commit prefix → categoria:
- `feat:` → feature (Novità)
- `fix:` → bugfix (Correzione)
- `perf:`, `refactor:` → improvement (Miglioramento)
- `chore:`, `ci:`, `build:` → maintenance (Manutenzione)
- Commit senza prefix vengono ignorati (o raggruppati)

L'edge function accetta un payload come:
```json
{
  "commits": [
    { "message": "feat: aggiunto filtro per data nel calendario", "author": "..." }
  ],
  "version": "1.2.0"  // opzionale, da tag
}
```

Autenticazione: verifica un secret `CHANGELOG_WEBHOOK_SECRET` nell'header per evitare chiamate non autorizzate.

### 2. GitHub Actions Workflow
File `.github/workflows/changelog.yml` che:
- Si attiva su push al branch `main`
- Estrae i commit messages dal push
- Filtra solo quelli con prefix convenzionali
- Chiama l'edge function con i dati

### 3. Secret necessario
- `CHANGELOG_WEBHOOK_SECRET`: token condiviso tra GitHub Actions e l'edge function per autenticare le richieste

Il secret va configurato sia in Supabase (edge function) che in GitHub (repository secret).

## File da creare/modificare

| File | Azione |
|------|--------|
| `supabase/functions/changelog-from-commits/index.ts` | Creare - edge function |
| `.github/workflows/changelog.yml` | Creare - GitHub Actions workflow |

## Note
- I commit che non seguono la convenzione (senza prefix tipo `feat:`, `fix:` ecc.) vengono ignorati automaticamente
- La versione può essere estratta dal tag Git se presente, altrimenti omessa
- Nessuna modifica al database necessaria: la tabella `changelog` esiste già con la struttura corretta

