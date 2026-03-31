

## Fix errore `invalid_request` OAuth Fatture in Cloud

### Problema
Lo scope `issued_documents:a` non esiste nelle API di Fatture in Cloud. Gli scope per i documenti emessi sono specifici per tipo (es. `issued_documents.quotes:a`, `issued_documents.invoices:a`, ecc.). FIC rifiuta la richiesta con `invalid_request`.

### Soluzione
Modificare la riga 157 di `supabase/functions/fatture-in-cloud-oauth/index.ts`:

**Da:**
```
scope = "entity.suppliers:a settings:a issued_documents:a"
```

**A:**
```
scope = "entity.suppliers:a settings:a issued_documents.quotes:a"
```

Questo è l'unico scope necessario per i documenti emessi, dato che l'integrazione invia solo preventivi (quotes) a FIC.

### File da modificare
- `supabase/functions/fatture-in-cloud-oauth/index.ts` — riga 157, correzione scope

### Verifica
Dopo il deploy, ri-testare il flusso OAuth cliccando "Collega account Fatture in Cloud" nella sezione Integrazioni.

