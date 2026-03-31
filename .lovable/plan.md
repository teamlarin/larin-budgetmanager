

## Rinomina e migliora widget "Siti WpZen"

### Contesto
Il badge "Attivo" dipende dal campo `site.status` restituito dall'API Kinsta. Se `status === 'live'` mostra "Attivo" (verde), altrimenti mostra il valore raw dello status. Questo è un campo gestito da Kinsta che indica se il sito è attivo/online.

### Modifiche — `src/components/dashboards/KinstaSitesWidget.tsx`

1. **Rinominare** titolo da "Siti Kinsta" a "Siti WpZen" e descrizione coerente
2. **Rimuovere** il link esterno a MyKinsta (icona ExternalLink)
3. **Mostrare le etichette** (`site_labels`) come Badge accanto al nome del sito
4. **Mostrare il dominio** come testo (non link esterno, solo testo informativo con icona Globe)
5. **Aggiungere filtro per etichetta**: un Select in cima alla lista che raccoglie tutte le etichette uniche dai siti e filtra la lista. Opzione "Tutte" come default.

### Struttura UI risultante

```text
┌─────────────────────────────────────────┐
│ 🖥 Siti WpZen                           │
│ Siti WordPress gestiti                  │
│                                         │
│ [Filtro etichetta: Tutte ▼]             │
│                                         │
│ ┌─────────────────────────────────────┐ │
│ │ Site Name        [label1] [label2]  │ │
│ │ 🌐 example.com           [Attivo]  │ │
│ └─────────────────────────────────────┘ │
│ ...                                     │
└─────────────────────────────────────────┘
```

### Dettagli tecnici
- Import `Select, SelectTrigger, SelectValue, SelectContent, SelectItem` da ui/select
- `useState` per il filtro etichetta selezionata
- Calcolo etichette uniche con `useMemo` dai dati ricevuti
- Filtraggio siti con `useMemo` basato sull'etichetta selezionata
- Rimozione import `ExternalLink`

