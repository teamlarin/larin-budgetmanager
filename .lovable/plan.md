

# Miglioramenti alla pagina Progetti Approvati

## Obiettivo
Dare visibilità immediata ai progetti che richiedono attenzione: scadenza imminente, marginalità residua bassa, progresso elevato (in chiusura).

## Cosa manca oggi
La pagina attuale è una tabella piatta con filtri. Per capire quali progetti sono critici bisogna ordinare manualmente per colonna e scorrere. Non c'è alcun indicatore visivo immediato di "attenzione necessaria".

## Proposta: Pannello di sintesi con indicatori di attenzione

### 1. Summary Cards sopra la tabella
Tre card compatte sopra i filtri che mostrano a colpo d'occhio:

```text
┌─────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ ⚠ Scadenza imminente│  │ 📉 Margine critico   │  │ 🏁 In chiusura       │
│ 4 progetti           │  │ 3 progetti            │  │ 5 progetti (>80%)    │
│ entro 14 giorni      │  │ margine ≤ obiettivo   │  │ progresso elevato    │
└─────────────────────┘  └──────────────────────┘  └──────────────────────┘
```

Cliccando su ciascuna card si apre un dialog con la lista dei progetti interessati (riutilizzando il pattern già presente in `AdminOperationsDashboard`).

### 2. Indicatori visivi nelle righe della tabella
- **Riga con sfondo colorato tenue** per progetti critici:
  - Rosso tenue: scadenza entro 7 giorni O margine residuo sotto il margine obiettivo
  - Arancione tenue: scadenza entro 14 giorni O margine residuo entro 5% sopra l'obiettivo
- **Icona di warning** nella colonna Data Fine per progetti in scadenza imminente (entro 7gg)
- **Badge "In chiusura"** accanto al progresso quando supera l'80%

### 3. Filtro rapido "Solo critici"
Un toggle/bottone accanto ai filtri esistenti che mostra solo i progetti con almeno un indicatore di attenzione (scadenza, margine, o progresso alto).

## Dettagli tecnici

### File da modificare
| File | Modifica |
|------|----------|
| `src/pages/ApprovedProjects.tsx` | Aggiungere summary cards, colorazione righe, filtro "critici" |

### Logica di classificazione (calcolata sui dati già disponibili)
- **Scadenza imminente**: `end_date` entro 14 giorni da oggi, solo progetti con status `aperto`
- **Margine critico**: `residualMargin ≤ margin_percentage` (stessa logica già usata per `isCritical`/`isWarning`)
- **In chiusura**: `progress ≥ 80%` (esclusi interno/consumptive)

Nessuna query aggiuntiva necessaria: tutti i dati sono già presenti nell'array `allProjects`.

