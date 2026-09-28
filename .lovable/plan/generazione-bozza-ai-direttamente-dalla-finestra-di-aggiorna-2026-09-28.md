# Generazione bozza AI direttamente dalla finestra di aggiornamento

Obiettivo: poter generare la bozza di aggiornamento direttamente dentro la finestra "Nuovo aggiornamento", senza dover aspettare il banner in cima alla scheda progetto.

## Comportamento

- Nella finestra "Nuovo aggiornamento", quando **non** esiste una bozza AI in attesa, compare un pulsante "Genera bozza AI" (icona Sparkles) in cima, con indicazione delle fonti analizzate (Slack, Meet/Drive, Gmail e canale del progetto).
- Al click:
  1. viene invocata la funzione di generazione per quel progetto (forzata);
  2. durante l'attesa il pulsante mostra "Generazione in corso..." ed è disabilitato;
  3. se la bozza viene creata, i campi della finestra si precompilano subito: **sintesi**, **stato di salute suggerito** e **roadblock proposti**, come avviene già con "Apri bozza" dal banner;
  4. il riquadro "Bozza AI applicata" resta visibile con le fonti e la possibilità di scartare.
- Se non vengono trovati segnali (nessuna attività recente) o esiste già un aggiornamento questa settimana, compare un avviso che spiega l'esito senza chiudere la finestra.
- Se una bozza esiste già, il pulsante non compare: vale il flusso attuale (Applica bozza / Solo sintesi / Scarta).
- Il banner in cima alla scheda progetto resta invariato.

## Dettagli tecnici

- `src/components/ProgressUpdateDialog.tsx`:
  - nuovo stato `generating` e funzione `handleGenerateDraft` che invoca `supabase.functions.invoke('generate-slack-progress-drafts', { body: { projectId, force: true } })` (stessa chiamata già usata da `ProgressUpdateDraftBanner`);
  - alla risposta con `stats.drafts_created > 0`: invalidazione della query `['progress-update-draft', projectId]` e precompilazione dei campi riusando la logica esistente di `autoApplyDraft` (impostando `draftApplied` al caricamento della nuova bozza);
  - gestione esiti: `skipped_already_updated` → avviso "Update già pubblicato questa settimana"; `skipped_no_messages` → avviso "Nessun segnale rilevante"; errori → toast con il messaggio;
  - rendering del pulsante solo quando `!draft && !draftDismissed`.
- Nessuna modifica all'Edge Function né al database: la generazione on-demand per singolo progetto esiste già.
- Verifica: `bunx tsgo --noEmit` e `bun run build`.
