# Focus su due colonne: "Da fare subito" a sinistra, "Urgente" a destra

## Cosa cambia

Nella sezione Focus della dashboard "La mia settimana" i due blocchi principali
vengono affiancati su due colonne negli schermi larghi (lg e superiori):

```text
┌───────────────────────────┐ ┌───────────────────────────┐
│ 🎯 Da fare subito         │ │ 🔴 Urgente                │
│ (prime 3 voci, priorità)  │ │ (restanti urgenti)        │
└───────────────────────────┘ └───────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ 🟡 Da tenere d'occhio (a larghezza piena, righe su 2    │
│    colonne interne come già previsto)                   │
└─────────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ 🟢 In corso (chiuso, espandibile — invariato)           │
└─────────────────────────────────────────────────────────┘
```

- Su schermi stretti (mobile/tablet) le due colonne si impilano naturalmente:
  prima "Da fare subito", poi "Urgente".
- "Da fare subito" resta il blocco delle prime 3 voci ordinate per punteggio;
  "Urgente" raccoglie le voci urgenti successive. Nessuna variazione al
  punteggio né ai motivi mostrati.
- "Da tenere d'occhio" passa sotto, a larghezza piena, mantenendo l'attuale
  griglia interna a due colonne per le righe.
- "In corso" resta collassato con il suo contatore.

## Come

Solo `src/components/dashboards/WeeklyFocusView.tsx`:

1. Inserire "Da fare subito" e "Urgente" in un contenitore
   `grid gap-4 lg:grid-cols-2 items-start` (i due blocchi restano card con i
   loro bordi colorati attuali).
2. Spostare il blocco "Da tenere d'occhio" dopo il contenitore a due colonne,
   a larghezza piena, senza cambiare il suo rendering interno.
3. Nessuna modifica a hook, query o logica di ordinamento.

## Verifica

- Typecheck (`bunx tsgo --noEmit`) e build OK.
- Controllo visivo della dashboard per confermare l'affiancamento delle due
  colonne e il comportamento responsive.
