

## Aggiornamento Account clienti da CSV

### Dati

Il CSV contiene 48 righe con:
- **Nome azienda** → da matchare con `clients.name`
- **Account** → nome della persona da mappare a `clients.account_user_id`

Mapping account:
| Nome | UUID |
|---|---|
| Sofia Baudino | `1833561e-698c-4427-8691-efce0b16704d` |
| Michele Da Rold | `1832fc5e-3bd9-45ec-8d10-63b8792dba78` |
| Alberto Nalin | `6cb9e18d-e355-4ed3-b25d-e948660b0095` |

### Implementazione

1. Eseguire uno script che per ogni riga del CSV:
   - Cerca il cliente per nome (`clients.name`) con match case-insensitive (`ILIKE`)
   - Aggiorna `account_user_id` con l'UUID corrispondente al nome Account
2. Loggare i clienti non trovati per verifica
3. Riportare il riepilogo (aggiornati / non trovati)

### Note
- Nessuna modifica al codice dell'app o allo schema DB
- Operazione una tantum via script SQL/psql
