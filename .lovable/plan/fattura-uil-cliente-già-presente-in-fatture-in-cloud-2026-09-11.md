# Fattura UIL: cliente già presente in Fatture in Cloud

## Cosa sta succedendo

Il cliente **UIL Veneto** in TimeTrap non ha ancora il collegamento con la sua scheda in Fatture in Cloud (verificato: il campo di collegamento è vuoto). Quando si emette la fattura, il sistema prova quindi a **creare** un cliente nuovo con quel nome, ma in Fatture in Cloud una scheda con la stessa denominazione esiste già: Fatture in Cloud rifiuta l'operazione e mostra il messaggio che hai visto.

Lo stesso problema si presenterà con ogni altro cliente presente in Fatture in Cloud ma non ancora collegato in TimeTrap.

## Cosa cambio

Prima di creare un cliente nuovo, il sistema **cerca in Fatture in Cloud una scheda con la stessa denominazione**:

- **Trovata una sola scheda**: la riutilizza, salva il collegamento sul cliente di TimeTrap e la fattura procede. Nessun doppione.
- **Nessuna scheda**: crea il cliente come oggi.
- **Più schede con lo stesso nome**: la fattura si ferma con un messaggio chiaro ("in Fatture in Cloud esistono più clienti chiamati così: apri Fatture in Cloud e verifica quale usare"), invece dell'errore tecnico attuale. In questo caso il collegamento resta da sistemare a mano su Fatture in Cloud.

Il collegamento salvato vale per sempre: dalla seconda fattura in poi il cliente viene usato direttamente, senza ricerche.

Dopo la modifica riprovo l'emissione della fattura UIL in modalità di prova (che costruisce il documento senza inviarlo) per confermare che il cliente venga agganciato correttamente, e poi lascio a te l'emissione reale.

## Dettagli tecnici

- `supabase/functions/fic-adapter/index.ts`, `opUpsertClient`: oggi fa solo `POST /c/{companyId}/entities/clients`. Aggiungo prima una `GET /c/{companyId}/entities/clients?q=name = '<nome>'` (con escape degli apici), filtrando lato codice per corrispondenza esatta e case-insensitive del `name`.
  - 1 risultato → scrivo `clients.fic_id` e restituisco quell'id, senza POST.
  - 0 risultati → POST come oggi.
  - più risultati → errore di dominio parlante (non ritentabile), gestito come gli altri errori FiC.
- Lo scope necessario (`entity.clients:a`) copre già la lettura, quindi non serve ricollegare l'account; `OPERATION_SCOPES` resta invariato.
- `invoice-issue` non cambia: continua a chiamare `upsertClient` e a gestire il fallimento con `mark_invoice_issue_failed`, che riporta la riga a "prevista" (nessun documento viene creato in caso di errore sul cliente).
- Nessuna migrazione: `clients.fic_id` esiste già.
