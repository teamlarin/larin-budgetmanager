

# Riallineamento PDF preventivo al layout di riferimento

## Differenze tra PDF attuale e PDF di riferimento

Analizzando il PDF allegato (Preventivo-408), il layout attuale presenta queste differenze significative:

| Aspetto | PDF di riferimento | PDF attuale |
|---------|-------------------|-------------|
| **Posizione logo/Larin** | In alto a SINISTRA | In alto a DESTRA |
| **Posizione SPETTABILE/cliente** | In alto a DESTRA | In alto a SINISTRA |
| **Titolo preventivo** | Allineato a sinistra, bold | Centrato |
| **Nome progetto** | Sotto il titolo, bold, sinistra | Centrato |
| **Tabella prodotti** | NO header colorato, NO colonna "Categoria", NO "Modalità Pagamento". Colonne: Nome+Descrizione | Prezzo Unit. | Qtà | Totale | IVA% | Header blu con 6 colonne |
| **Righe tabella** | Nome bold + descrizione sotto nella stessa cella, separate da linee orizzontali | Righe piatte senza descrizione |
| **Riepilogo** | IMPONIBILE / IVA 22% / TOTALE in box compatto con bordi | SUBTOTALE / IVA / TOTALE in tabella plain |
| **Note** | Sezione NOTE con condizioni pagamento | Simile ma con "Ore Totali" |
| **BONIFICO BANCARIO** | Presente in fondo con IBAN | Assente |
| **Footer** | "Larin Srl - C.F. e P.I. 01144900253 - PAG X di Y" | Identico |
| **Quote number** | Numero reale (es. "408") | UUID troncato |

## Modifiche a `src/lib/generatePdfQuote.ts`

### 1. Invertire posizioni header
- Logo + dati Larin → alto SINISTRA
- SPETTABILE + dati cliente → alto DESTRA

### 2. Titolo allineato a sinistra
- "Preventivo n. {quote_number} del {data}" a sinistra, bold
- Nome progetto sotto, bold, sinistra (senza descrizione centrata)

### 3. Riscrivere la tabella
Rimuovere le colonne "Categoria" e "Modalità Pagamento". Nuova struttura a 5 colonne:
- **Prodotto/Servizio** (largo, con nome bold + descrizione sotto)
- **Prezzo Unit.** (allineato a destra, formato `€ X.XXX,XX`)
- **Quantità** (centrato)
- **Totale** (allineato a destra)
- **IVA** (es. "22%")

Theme minimal: no header colorato, solo linee orizzontali tra le righe.

### 4. Riepilogo con box
Formato compatto allineato a destra:
```
         IMPONIBILE    IVA 22%      TOTALE
         € 12.116,00   € 2.665,52   € 14.781,52
```
Con bordi e sfondo leggero sul totale.

### 5. Aggiungere sezione BONIFICO BANCARIO
In fondo alla pagina: "BONIFICO BANCARIO" bold + "IBAN: IT44B0585661160115571260916"

### 6. Usare quote_number reale
Passare il `quote_number` dalla quote (già disponibile nei dati) invece di troncare l'UUID del progetto. Aggiornare l'interfaccia `QuoteData` per accettare `quoteNumber` e `quoteDate`.

### 7. Formattazione numeri italiana
Usare il formato `€ 1.234,00` con separatore migliaia punto e decimali virgola (locale `it-IT`).

## Aggiornamento chiamate

Nei file che invocano `generatePdfQuote` (`QuoteDetail.tsx`, `Quotes.tsx`, `ProjectCard.tsx`), passare `quoteNumber` e `quoteDate` dal record della quote.

## File da modificare

| File | Modifica |
|------|----------|
| `src/lib/generatePdfQuote.ts` | Riscrittura completa del layout |
| `src/pages/QuoteDetail.tsx` | Passare `quoteNumber` e `quoteDate` |
| `src/pages/Quotes.tsx` | Passare `quoteNumber` e `quoteDate` |
| `src/components/ProjectCard.tsx` | Passare `quoteNumber` (se disponibile) |

