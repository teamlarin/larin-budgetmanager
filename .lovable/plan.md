# Riordino menu e rimozione voce "Preventivi (archivio)"

## Obiettivo
Pulire la barra di navigazione: togliere la voce "Preventivi (archivio)" dal menu e riordinare voci principali e sottomenu Finanza.

## Cosa cambia

Menu principale, nuovo ordine:
1. Calendario
2. Progetti
3. Budget
4. Flussi
5. Finanza

Sottomenu Finanza, nuovo ordine:
1. Cruscotto
2. Offerte
3. Gare
4. Fatture
5. Abbonamenti

Note:
- "Offerte" si sposta dal menu principale al sottomenu Finanza.
- "Preventivi (archivio)" viene rimosso dal menu. Le pagine restano raggiungibili via URL diretto e dai link esistenti (dettaglio offerta con riferimento legacy, dashboard, budget), come richiesto.
- I permessi attuali restano invariati: Finanza visibile ad admin/account/finance, Gare solo admin; Offerte mantiene la visibilità attuale (admin/account/team leader) all'interno del dropdown.

## Dettagli tecnici
- File toccato: `src/components/AppHeader.tsx`.
  - Riordino dei `NavLink` nella `<nav>` (Calendario, Progetti, Budget, Flussi, poi dropdown Finanza).
  - Spostamento della voce Offerte dentro `DropdownMenuContent` come `DropdownMenuItem` con `navigate('/offers')`.
  - Rimozione del `DropdownMenuItem` "Preventivi (archivio)".
  - Aggiornamento di `financePaths` a `['/sales', '/offers', '/tenders', '/invoices', '/subscriptions']` così l'evidenziazione "attivo" resta corretta.
  - Il dropdown Finanza viene mostrato anche a team leader se ha solo accesso a Offerte, in modo da non perdere l'accesso alla sezione.
- Nessuna modifica a rotte, pagine o database.
