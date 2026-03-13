

# Gestione margine per progetti senza budget (interno, pre_sales, consumptive)

## Problema
I progetti interni, pre-sales e a consuntivo non hanno un budget definito su cui calcolare il margine residuo. L'indicatore circolare e gli alert di margine critico non hanno senso per questi tipi.

## Modifiche in `src/pages/ApprovedProjects.tsx`

### 1. Colonna Margine: solo costi sostenuti
Per i progetti con `billing_type` = `interno`, `pre_sales` o `consumptive`:
- Sostituire il CircularProgress con il solo totale costi sostenuti (es. `€1.234`)
- Il tooltip mantiene il dettaglio costi (labor + esterni) ma senza riferimenti a margine obiettivo, target budget o margine residuo

### 2. Esclusione dagli alert di margine
- `classifyProject`: `marginCritical` forzato a `false` per questi billing type
- La card "Margine critico" e il filtro "Solo critici" non li contano per la dimensione margine (possono ancora comparire per scadenza o chiusura)

### 3. Esclusione dalla colorazione riga per margine
La riga si colora in rosso solo per scadenza critica, non per margine, se il progetto è di tipo interno/pre_sales/consumptive.

### File coinvolto
| File | Modifica |
|------|----------|
| `src/pages/ApprovedProjects.tsx` | Condizione su billing_type per colonna margine, classifyProject, rendering cella |

