

## Integrazione Kinsta Sites nella dashboard Finance

### Panoramica
Creare un widget nella sezione Finance della dashboard che mostra la lista dei siti WordPress dal pannello Kinsta aziendale, aggiornata automaticamente tramite le API Kinsta.

### Prerequisiti - Secrets
Servono 2 secrets da configurare:
- **KINSTA_API_KEY**: API key generata da MyKinsta > Impostazioni azienda > API Keys
- **KINSTA_COMPANY_ID**: ID azienda (visibile nell'URL di MyKinsta, parametro `idCompany`)

### Modifiche

**1. Edge Function `supabase/functions/kinsta-sites/index.ts`**
- Endpoint che fa da proxy verso `GET https://api.kinsta.com/v2/sites?company={KINSTA_COMPANY_ID}`
- Usa Bearer token con `KINSTA_API_KEY`
- Restituisce la lista dei siti con nome, stato, e dettagli ambiente (dominio, PHP version, ecc.)
- CORS headers standard
- Validazione JWT dell'utente autenticato

**2. Componente `src/components/dashboards/KinstaSitesWidget.tsx`**
- Widget autonomo (coerente con l'architettura esistente dei widget indipendenti)
- Usa `useQuery` per chiamare l'edge function tramite `supabase.functions.invoke('kinsta-sites')`
- Mostra una Card con la lista dei siti: nome del sito, dominio primario, stato (attivo/in staging), e un link diretto a MyKinsta
- Stato di loading con Skeleton
- Gestione errori

**3. `src/components/dashboards/FinanceDashboard.tsx`**
- Aggiungere il `KinstaSitesWidget` in fondo alla dashboard, dopo la sezione "Progetti da Fatturare"

**4. `supabase/config.toml`**
- Aggiungere configurazione per la nuova function

### Dettagli tecnici

API Kinsta utilizzata:
```
GET https://api.kinsta.com/v2/sites?company={company_id}
Headers: Authorization: Bearer {api_key}
```

Risposta attesa:
```json
{
  "company": {
    "sites": [
      {
        "id": "...",
        "name": "site-name",
        "display_name": "Site Name",
        "status": "live",
        "site_labels": [...],
        "environments": [{ "id": "...", "name": "live", "display_name": "Live", "primary_domain": { "name": "example.com" } }]
      }
    ]
  }
}
```

Il widget mostrerà per ogni sito: display name, dominio primario, badge di stato, e link esterno a MyKinsta.

