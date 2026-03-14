

# Miglioramenti sezione Preventivi (/quotes)

## Analisi stato attuale

### Lista preventivi (Quotes.tsx)
- Tabella funzionale con filtri per stato e account, ricerca, ordinamento
- Manca filtro per cliente
- Data nel formato lungo ("dd MMM yyyy HH:mm") — l'ora è raramente utile nella lista
- Nessun link diretto al budget da cui è stato generato
- Download PDF dal dropdown menu — operazione frequente nascosta

### Dettaglio preventivo (QuoteDetail.tsx — 1360 righe)
- Header con informazioni sparse (progetto, cliente, account, stato) in griglia piatta
- **Margine ancora presente** nell'UI (campo editabile) ma non più utilizzato nei budget — da rimuovere
- Modalità "modifica tutto" con bottone Modifica/Salva globale — funziona ma pesante per modifiche rapide
- Card "Informazioni Preventivo" ripete dati già visibili nell'header
- Manca il link al budget di origine
- Manca il referente cliente (campo `client_contact_id` del budget)
- Calcolo totale prodotti usa `/1.22` hardcoded in visualizzazione (riga 1080) invece di usare `vat_rate` del prodotto

## Modifiche proposte

### 1. Lista preventivi — pulizia e accesso rapido

- **Rimuovere colonna "Account"** dalla tabella (dato secondario, visibile nel dettaglio)
- **Aggiungere filtro per cliente** (Select con lista clienti unici, come già fatto per account)
- **Data compatta**: formato `dd/MM/yy` senza ora
- **Bottone PDF diretto** nella riga (icona Download visibile, non nascosta nel dropdown)
- **Link al budget**: nel dropdown menu, aggiungere "Visualizza budget" accanto a "Visualizza progetto"

### 2. Dettaglio preventivo — riorganizzazione header

Sostituire la card "Informazioni Preventivo" con un header strutturato simile a quello del budget:
- **Card sinistra**: N° preventivo, data, stato (editabile inline con QuoteStatusSelector), link al budget di origine
- **Card destra**: Cliente, Referente (dal budget), Account

### 3. Rimuovere margine

- Eliminare il campo "Margine" dal riepilogo (sia visualizzazione che editing)
- Rimuovere lo state `margin` e il relativo salvataggio

### 4. Fix calcolo IVA prodotti

Nella visualizzazione del totale prodotto (riga 1080), usare `product.vat_rate` invece di hardcoded `1.22`.

### 5. Editing inline dello stato

Rendere lo stato editabile direttamente nell'header (senza bisogno di entrare in modalità "Modifica"), usando `QuoteStatusSelector` già disponibile.

## File da modificare

| File | Modifica |
|------|----------|
| `src/pages/Quotes.tsx` | Rimuovere colonna Account, filtro cliente, data compatta, bottone PDF visibile, link budget |
| `src/pages/QuoteDetail.tsx` | Header ristrutturato, rimuovere margine, fix IVA prodotti, stato inline |

