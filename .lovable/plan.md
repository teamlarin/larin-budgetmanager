

# Miglioramenti Calendario - Piano di Implementazione

## Cosa implementeremo

4 miglioramenti ad alto impatto per velocizzare pianificazione e tracciamento del tempo:

### 1. Pulsante "Conferma tutte" nella toolbar
Aggiunge un pulsante nella barra del riepilogo settimanale che conferma in batch tutte le attività con orario di fine nel passato e non ancora confermate. Una singola operazione invece di N click destro + conferma.

- Posizione: accanto al riepilogo settimanale, visibile solo se ci sono attività da confermare
- Badge con conteggio attività confermabili
- Mutation batch che aggiorna tutti i record in una sola chiamata

### 2. Icona conferma inline sulle attività
Aggiunge un'icona di conferma (CheckCircle) visibile direttamente sull'attività nella griglia, senza dover usare il context menu. Appare solo quando `canConfirm` è true (orario fine passato e non già confermata).

- Posizione: angolo in basso a destra dell'attività
- Click diretto per confermare
- Stile: icona verde con hover effect

### 3. Scorciatoie da tastiera
- `T` = vai a oggi
- `ArrowLeft` = settimana precedente
- `ArrowRight` = settimana successiva
- `C` = conferma tutte le passate (batch)

Implementato con un `useEffect` + `keydown` listener sul componente Calendar, ignorato se focus è su input/textarea.

### 4. Vista giornaliera
Toggle Day/Week nella toolbar. In vista giornaliera:
- Mostra un solo giorno con griglia oraria più ampia
- Navigazione giorno per giorno (frecce)
- Header del giorno con riepilogo dettagliato (breakdown per progetto)
- La sidebar rimane invariata

## Modifiche tecniche

**File modificato:** `src/pages/Calendar.tsx`

### Dettagli implementazione

**Batch confirm**: nuova mutation `batchConfirmMutation` che filtra `timeTracking` per attività confermabili (end time nel passato, no actual times) e fa un loop di update. Pulsante nel blocco del riepilogo settimanale.

**Inline confirm icon**: nel componente `ScheduledActivity`, aggiungere un div assoluto in basso a destra con `CheckCircle`, visibile solo quando `canConfirm === true`, con `onClick` che chiama `onConfirm`.

**Keyboard shortcuts**: `useEffect` con listener `keydown` nel componente `Calendar()`, con guard per input/textarea focus.

**Vista giornaliera**: nuovo state `viewMode: 'week' | 'day'` e `selectedDayDate`. In modalità day, `weekDays` ritorna un solo giorno. Toggle nella toolbar accanto alla navigazione date. La navigazione cambia comportamento: in day mode, avanza/indietreggia di 1 giorno (saltando weekend se `showWeekends` è false).

