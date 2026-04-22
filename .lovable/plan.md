

## Compattare il blocco Slack nella scheda di progetto

Il selettore canale Slack oggi occupa molto spazio: ha un'etichetta dedicata "Canale Slack", un badge separato, fino a 3 pulsanti affiancati (Cambia / Rimuovi / Verifica) e un Alert destructive a tutta larghezza quando ci sono errori. Lo allineo allo stile compatto del selettore Drive che gli sta accanto.

### Cosa cambia (solo `src/components/ProjectSlackChannelPicker.tsx`)

**Trigger compatto** (sostituisce label + badge + 3 bottoni):
- Un singolo bottone `outline` con icona Slack + nome canale truncato (`#nome-canale`, max 220px), identico nello stile al bottone Drive accanto
- Stato canale mostrato come piccola icona dentro al bottone:
  - `CheckCircle2` verde se ok
  - `AlertTriangle` rossa se c'è errore di verifica
- Bottone `Scollega` ridotto a un'icona `X` ghost (8×8), affiancata
- Quando non c'è canale: bottone "Collega Slack" singolo
- Per utenti senza permessi (canEdit=false): Badge sola, come prima
- Tooltip nativo `title=""` mostra il messaggio di errore o il nome completo del canale

**Errore di verifica** (rimosso l'Alert grande):
- Niente più `Alert` destructive sotto al bottone (toglie ~80px di altezza)
- L'errore tipizzato (titolo + descrizione + CTA "Come risolvere" / "Cambia canale" / "Riprova") viene spostato **dentro al Dialog**, mostrato in cima quando l'utente lo apre cliccando il bottone in stato di errore
- Il segnale visivo dell'errore resta sempre visibile come icona rossa nel bottone

**Pulsante "Verifica" rimosso dalla riga**: la verifica si triggera all'apertura del dialog (già succede via `useQuery`) e con un piccolo "Aggiorna" già presente in fondo alla lista.

### Risultato

```text
prima:   [Canale Slack       ]
         [#general ✓] [Cambia canale] [Rimuovi] [↻]
         ┌───────────────────────────────────────┐
         │ ⚠ Permessi Slack insufficienti        │
         │ Errore Slack: missing_scope           │
         │ [Come risolvere] [Riprova]            │
         └───────────────────────────────────────┘

dopo:    [📁 Cartella Drive] [💬 #general ✓] [✕]
                              ↑ singolo bottone, errore = icona rossa interna,
                                Alert completo solo nel dialog quando lo apri
```

Altezza dell'header progetto ridotta da ~140px (con alert) / ~80px (senza) a ~36px, allineato esattamente al Drive picker.

### File toccati

- `src/components/ProjectSlackChannelPicker.tsx` — refactor del JSX di trigger e spostamento dell'alert dentro al dialog

Nessuna modifica al backend, alla logica di sync o ai permessi.

