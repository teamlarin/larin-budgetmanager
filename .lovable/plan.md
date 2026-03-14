

# Miglioramento esportazione PDF/PNG della Timeline

## Problemi attuali

Dall'analisi del PDF esportato emergono diversi problemi:

1. **Troncamento testo** — I nomi delle attività nella colonna sinistra vengono tagliati ("Redazione NL (1/mese..." → troncato)
2. **Barre troppo strette** — Le barre colorate non hanno abbastanza spazio per mostrare il testo completo
3. **Scala temporale** — Per progetti lunghi (365 giorni), i marker settimanali sono troppi e illeggibili. Servono marker mensili
4. **Nessun padding/margini** — Il contenuto arriva ai bordi della pagina
5. **PDF formato pixel** — Il PDF usa dimensioni in pixel dal canvas anziché un formato standard (A4/A3 landscape)
6. **Colonna sinistra troppo stretta** — 192px (`w-48`) non bastano per nomi attività lunghi
7. **Grip icon e tooltip** — Elementi interattivi (⋮⋮ drag handle, tooltip) non hanno senso nell'export statico

## Modifiche proposte

### 1. Modalità export dedicata
Aggiungere uno stato `isExporting` che modifica il rendering per l'export:
- Nasconde le icone drag (GripVertical)
- Nasconde il subtitle "(⋮⋮ riordina righe...)"
- Allarga la colonna attività a `w-64` (256px)
- Mostra il nome completo senza troncamento

### 2. Scala temporale adattiva
Per progetti con durata > 60 giorni, usare marker **mensili** invece che settimanali. Per progetti > 180 giorni, mostrare solo il mese abbreviato (es. "Gen", "Feb").

### 3. PDF in formato A4/A3 landscape con margini
Sostituire il formato pixel con:
- Landscape A3 per progetti con molte attività
- Margini di 15mm
- Scaling proporzionale dell'immagine nel PDF

### 4. Classe CSS per export
Aggiungere al `chartRef` una classe condizionale `exporting` che:
- Disattiva `truncate` sui nomi attività
- Aggiunge padding extra
- Imposta una larghezza minima più generosa per le barre

### 5. Titolo nel documento esportato
Aggiungere un header visibile solo in export con il nome del progetto e le date, così il PDF è autoesplicativo.

## File da modificare

| File | Modifica |
|------|----------|
| `src/components/ActivityGanttChart.tsx` | Stato export, scala temporale adattiva, rendering condizionale, PDF A4/A3, titolo export |

