# Riepilogo ore team: ripristino filtri e dati mensili

## Causa
Nella tab Team della dashboard, `TeamWeekView.tsx` (riga 491) renderizza `UserHoursSummary` con `compactMode` dentro l'accordion "Andamento ore". La modalità compatta nasconde:
- il filtro per tipo contratto (Dipendenti / Freelance / Consuntivo) e il conteggio utenti;
- le colonne mensili: Confermate, Recuperate, Previste, Saldo mese, Riporto, Progresso, Export CSV;
- l'espansione della riga con il dettaglio mese per mese;
- il riepilogo totali a 6 metriche (restano solo Saldo anno e Prod. billable).

Il selettore del mese invece c'è già anche in modalità compatta.

## Modifica
- `src/components/dashboards/TeamWeekView.tsx`: rimuovere `compactMode` dalla chiamata (`<UserHoursSummary filterUserIds={filterUserIds} />`). Il filtro per area/utenti del team leader resta attivo tramite `filterUserIds`.
- Nessuna modifica a `UserHoursSummary.tsx`: la modalità completa esiste già.
- Nota: in modalità completa il mese di default torna a essere quello corrente (in compatta era il mese precedente) — coerente con la dashboard finance che usa lo stesso componente.

## Verifica
- `tsgo --noEmit` e build.
- Controllo visuale via Playwright sulla tab Team: filtro contratto visibile, colonne mensili presenti, navigazione mesi funzionante.
