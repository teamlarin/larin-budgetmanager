# Focus più leggibile: "su cosa lavoro questa settimana"

## Problema
La sezione Focus mostra tutte le righe (progetti e task) come card grandi e uguali tra loro, senza gerarchia: chip rossi ovunque, tre pulsanti per riga, e le task compaiono due volte (nel Focus e nel widget "Le mie task" sotto). Il risultato è una lista lunga in cui non si capisce da dove partire.

## Cosa cambia

**1. Le prime 3 cose da fare, in evidenza**
In cima al Focus una fascia "Da fare subito" con le 3 voci a priorità più alta (mix di progetti e task), come righe compatte: cosa, per chi, perché è urgente, un solo pulsante d'azione principale.

**2. Il resto raggruppato per urgenza, con intestazioni**
Tre gruppi con titolo e conteggio: Urgente / Da tenere d'occhio / In corso.
- Urgente e Da tenere d'occhio aperti.
- In corso chiuso di default (si apre con un clic), perché è la parte informativa.

**3. Righe compatte invece di card**
Ogni voce su una riga: nome + cliente, al massimo 2 motivi (i più forti), e un solo pulsante principale (Apri canvas per i progetti, Completa per le task). Le altre azioni (Pianifica, Aggiorna progresso, Apri progetto) passano in un menu "..." sulla riga.

**4. Meno duplicazione**
Le task già presenti nel Focus non vengono ripetute nel widget "Le mie task": il widget resta ma elenca solo le task non incluse nel Focus, con titolo "Altre task assegnate".

**5. Chip dei motivi più leggibili**
Colore legato alla gravità reale: rosso solo per scaduto/scade oggi, ambra per scadenze entro la settimana e budget oltre soglia, grigio per informazioni (ore pianificate, nessun aggiornamento). Oggi è tutto rosso e perde di significato.

Restano invariati: barra capacità, "Da recuperare", "Oggi", filtro area, calcolo del punteggio.

## Dettagli tecnici
- `src/components/dashboards/WeeklyFocusView.tsx`: nuova struttura del blocco Focus (top 3 + gruppi per `bucket` con `Collapsible` per `ongoing`), righe compatte con `DropdownMenu` per le azioni secondarie, chip con severità derivata dal testo del motivo tramite una mappa in un helper.
- Nuovo `src/lib/focusSeverity.ts`: da `reasons` a livello (`high` | `medium` | `info`) + limite a 2 chip visibili con "+N".
- `src/components/dashboards/MyTasksWidget.tsx`: nuova prop opzionale `excludeTaskIds: string[]` per non ripetere le task già nel Focus; `WeeklyFocusView` passa gli id delle task presenti nelle righe.
- Nessuna modifica a `useWeeklyFocus.ts`, `useMyTasks.ts`, database o RLS.
