

## Adeguare colori e badge del "Carico di lavoro" nella TeamLeader Dashboard

### Differenze attuali

La **Operations Dashboard** (WorkloadSummaryWidget) usa:
- **Barra colorata**: rosso (>100%), ambra (80-100%), blu (<50%), primary (50-80%)
- **Testo colorato**: rosso, ambra, blu, default — stesse soglie
- **Badge**: "Sovraccarico" (rosso, >100%), "Scarico" (blu, <50%)
- **Percentuale visibile** accanto alle ore

La **TeamLeader Dashboard** usa:
- **Barra**: solo rosso (>100%) o primary
- **Nessun badge** "Sovraccarico"/"Scarico"
- **Nessun colore testo** sulla percentuale
- Mostra "X libere" / "Pieno" invece della percentuale

### Modifica

**File: `src/components/dashboards/TeamLeaderDashboard.tsx`**, sezione workload (righe ~390-424)

1. Aggiungere funzioni `getBarColor` e `getTextColor` con le stesse soglie del WorkloadSummaryWidget (>100% rosso, ≥80% ambra, <50% blu, resto primary)
2. Applicare `getBarColor` alla Progress bar al posto del check binario `isOverloaded`
3. Aggiungere la **percentuale con colore** (`getTextColor`) accanto alle ore
4. Aggiungere i **badge** "Sovraccarico" (>100%) e "Scarico" (<50% con capacità >0) accanto al nome, come nel WorkloadSummaryWidget
5. Rimuovere l'icona AlertTriangle inline (sostituita dal badge)

