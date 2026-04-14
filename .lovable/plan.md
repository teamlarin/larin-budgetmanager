

## Visualizzazione scheda completa nella sezione Performance (Impostazioni)

### Problema
Quando si seleziona una scheda performance nella gestione admin, il pannello dettaglio mostra solo "Obiettivi" e "Note Trimestrali". I dati della scheda (ruolo, team, compenso, percorso di carriera, punti di forza, ecc.) sono visibili solo aprendo il dialog di modifica.

### Soluzione
Aggiungere una terza tab "Scheda" (o renderla la prima) nel pannello dettaglio della review selezionata, con una vista read-only di tutti i campi della scheda organizzati in card.

### Modifiche

**`src/components/PerformanceReviewManagement.tsx`**:
- Aggiungere una nuova tab "Scheda" come prima tab nel pannello dettaglio (prima di Obiettivi e Note Trimestrali)
- La tab mostra in read-only:
  - **Percorso Professionale**: ruolo, team, team leader, data inizio, tipo contratto, compenso, storico variazioni
  - **Sviluppo Professionale**: ruolo obiettivo, obiettivo lungo termine, supporto azienda
  - **Valutazione**: punti di forza, aree di miglioramento
- Layout con card e grid 2 colonne per i campi, simile al componente `PerformanceReviewTab.tsx` già usato nel profilo utente
- Import delle icone aggiuntive necessarie (Briefcase, GraduationCap, Star)

### Nessuna modifica al database o ad altri file.

