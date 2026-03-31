

## Fix connessione OAuth Fatture in Cloud

### Problema
L'errore "Connessione negata da secure.fattureincloud.it" indica che FIC rifiuta la richiesta OAuth prima ancora di mostrare la pagina di login. Causa probabile: Client ID/Secret non corrispondenti o OAuth non abilitato nell'app FIC.

### Azioni

#### Step 1 — Aggiornare i secrets in Supabase
Sovrascrivere i due secrets con i valori corretti forniti dall'utente:
- `FATTURE_IN_CLOUD_CLIENT_ID` → `fKADYAh0Y4mGr3ZMLrQAuvmZjWbIHQFE`
- `FATTURE_IN_CLOUD_CLIENT_SECRET` → `LXS55eOyhFPXWgaM4YDDRS0iQld5N6aI2mLq6h157WBX51UNgLqP1gU21p28EnZj`

#### Step 2 — Verifica manuale dall'utente (non richiede modifiche codice)
Nella pagina dell'app su Fatture in Cloud (https://developers.fattureincloud.it), verificare che:
- Il metodo **OAuth 2.0 (Authorization Code Flow)** sia selezionato e salvato
- Il Redirect URL sia esattamente: `https://dmwyqyqaseyuybqfawvk.supabase.co/functions/v1/fatture-in-cloud-oauth`

#### Step 3 — Test
Riprovare il collegamento OAuth dalla sezione Integrazioni.

### Nessuna modifica al codice
Il codice è corretto. L'unica azione è aggiornare i secrets.

