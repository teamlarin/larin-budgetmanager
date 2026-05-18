## Problema

In dark mode le attività a calendario usano `bg-card` (quasi nero, identico allo sfondo della griglia) con un solo accento di 4px sul bordo sinistro colorato per categoria. Risultato: i blocchi si confondono con lo sfondo e si fatica a leggerli/distinguerli per categoria.

## Soluzione

Sostituire lo sfondo piatto `bg-card` con un **tint colorato per categoria**, leggibile sia in light che dark mode, mantenendo invariata la logica esistente per stati speciali (completato verde, tracking in corso blu).

### 1. `src/lib/categoryColors.ts`

Aggiungere una nuova mappa `categoryColorsTinted` (sfondo tenue + bordo soft) e relativo helper `getCategoryTintedBg(category)`. Esempio:

```ts
ADV:        'bg-amber-100   dark:bg-amber-500/20',
AI:         'bg-violet-100  dark:bg-violet-500/20',
Analisi:    'bg-cyan-100    dark:bg-cyan-500/20',
Automation: 'bg-fuchsia-100 dark:bg-fuchsia-500/20',
Consulenza: 'bg-lime-100    dark:bg-lime-500/20',
Content:    'bg-teal-100    dark:bg-teal-500/20',
Design:     'bg-orange-100  dark:bg-orange-500/20',
Dev:        'bg-green-100   dark:bg-green-500/20',
Management: 'bg-blue-100    dark:bg-blue-500/20',
Off:        'bg-stone-100   dark:bg-stone-500/20',
'Social Media': 'bg-pink-100 dark:bg-pink-500/20',
Support:    'bg-red-100     dark:bg-red-500/20',
Altro:      'bg-slate-100   dark:bg-slate-500/20',
```

Le opacità `/20` sul nero garantiscono contrasto sufficiente in dark mode senza essere "fluo"; in light mode i `-100` restano morbidi ma chiaramente distinguibili dalla griglia bianca.

### 2. `src/components/calendar/ScheduledActivity.tsx` (riga 326)

Sostituire la classe `bg-card` di default con `getCategoryTintedBg(tracking.activity.category)`. Mantenere prioritari:
- `isCompleted` → `bg-green-100 dark:bg-green-900/40` (leggermente più carico per stacco)
- `isTrackingNow` → `bg-blue-100 dark:bg-blue-900/40`

Inoltre: aumentare leggermente lo spessore dell'accento sinistro da `border-l-4` a `border-l-[5px]` e il testo `text-muted-foreground` del nome progetto a `text-foreground/70` per migliorare il contrasto in dark.

### 3. Eventi Google Calendar (opzionale, coerenza)

In `src/components/GoogleCalendarEvent.tsx` applicare lo stesso pattern tint (tipicamente categoria "Meeting" / pink) così gli eventi non convertiti restano leggibili in dark.

## Out of scope

- Nessuna modifica alla logica di scheduling, drag, resize o overlap.
- Nessuna modifica ai colori delle categorie (rimangono quelli definiti).
- Nessun cambio al tema globale o ai token CSS in `index.css`.
