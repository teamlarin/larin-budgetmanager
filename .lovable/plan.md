## Obiettivo

Aggiungere alla sezione **🆕 Novità** di `/help` (tabella `changelog`) le novità significative dal 21 al 30 aprile 2026. Oggi l'ultima entry è del 20/04.

## Nuove entry da inserire

Date scelte raggruppando i commit reali per giornata significativa.

1. **2026-04-23 — Progress drafts AI da Gmail** (*feature*)  
   I draft settimanali di avanzamento progetto ora aggregano anche le email Gmail (impersonation domain-wide), oltre a Slack e trascrizioni Meet su Drive.

2. **2026-04-23 — Diagnostica cron e invocazione manuale** (*improvement*)  
   In Impostazioni → System Monitor è ora possibile lanciare manualmente i cron job HTTP, vedere ultime esecuzioni, errori e stato (admin only).

3. **2026-04-24 — Dialog AI draft integrato negli avanzamenti** (*feature*)  
   Quando crei un aggiornamento di progresso, un pulsante AI propone una bozza basata sulle attività della settimana — la puoi modificare prima di salvare.

4. **2026-04-24 — Aggiornamento progresso aperto a più ruoli** (*improvement*)  
   Membri del team e Project Leader possono ora aggiornare il progresso dei progetti di cui fanno parte (prima riservato ad admin/team leader).

5. **2026-04-25 — Area sui flussi (workflows)** (*feature*)  
   Ogni flusso può essere assegnato a un'area aziendale (Marketing, Tech, Branding, Sales, Jarvis, Struttura, Interno) per filtri e statistiche più chiari.

6. **2026-04-27 — Raggruppamento attività per disciplina nel canvas** (*feature*)  
   Nel canvas progetto le attività sono raggruppabili per disciplina, con totali per gruppo, ordinamento e collapse persistente.

7. **2026-04-27 — Cancellazione gruppo di attività** (*improvement*)  
   Nuovo dialog per eliminare in un colpo solo tutte le attività di un gruppo/disciplina, con conferma esplicita.

8. **2026-04-29 — Popover "Assegna" più affidabile** (*bugfix*)  
   Il popover di assegnazione attività ora mostra correttamente tutti gli utenti, inclusi quelli pianificati dal calendario o con ore già confermate. Risolto il caso dell'etichetta gialla mancante su progetti grandi (paginazione oltre i 1.000 record di tracking).

9. **2026-04-29 — Protezione assegnazioni implicite** (*improvement*)  
   Gli utenti con eventi pianificati o ore confermate non si possono più rimuovere accidentalmente dal popover: checkbox bloccata, icona 📅 e badge "Fuso" per i non-membri del team.

## Come

Migrazione SQL con 9 `INSERT INTO public.changelog (title, description, category, created_at)`. La sezione `/help#novita` è già ordinata per data e raggruppata per mese — le entry compaiono automaticamente nel gruppo "Aprile 2026".

## File toccati

- nuova migrazione SQL in `supabase/migrations/` con i 9 INSERT.

Nessuna modifica al codice React.