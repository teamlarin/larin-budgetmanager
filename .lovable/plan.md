

# Miglioramento tab "Timesheet"

## Situazione attuale

La tab ha già:
- 3 card riepilogo (ore pianificate, confermate, contabili)
- Filtri (utente, stato, date)
- Tabella con tutte le entry (expand per note, selezione/eliminazione bulk per admin)
- Maggiorazioni percentuali per utente/categoria
- Export CSV/Excel
- Condivisione link pubblico (token con scadenza 30gg, edge function `public-timesheet`)
- Import CSV

### Problemi
- **Condivisione basica**: il link pubblico mostra una tabella piatta senza filtri, senza raggruppamento, senza possibilità di export da parte del cliente
- **Nessun raggruppamento**: la tabella interna è una lista flat — per progetti Pack/Consuntivo serve vedere le ore aggregate per attività e per membro
- **Report per il cliente non personalizzabile**: il link pubblico non distingue tra Pack/Consuntivo e non permette al PM di scegliere cosa condividere (es. nascondere i nomi degli utenti)

## Proposta

### 1. Riepilogo per attività (nuova sezione, tab interna)

Aggiungere sopra la tabella delle entry un riepilogo collassabile **"Riepilogo per attività"** che mostra, per ogni `budget_item` con ore confermate:
- Nome attività, categoria
- Ore confermate totali / Ore previste a budget
- Mini progress bar
- Utenti che hanno lavorato sull'attività (badge compatti)

Utile per Pack/Consuntivo: il PM vede a colpo d'occhio quanto è stato consumato per ogni voce.

### 2. Migliorare il report pubblico condivisibile

Aggiornare la pagina `PublicTimesheet` e la edge function `public-timesheet`:

**Edge function** — aggiungere al response:
- `billing_type` del progetto
- Raggruppamento ore per attività (nome, categoria, ore totali)
- Flag `hide_users` passato come query param (opzionale)

**Pagina pubblica** — migliorare con:
- Badge tipologia progetto (Pack, Consuntivo, etc.)
- Sezione riepilogo per attività (tabella aggregata: attività, categoria, ore totali)
- Tabella dettaglio sotto (quella attuale), con possibilità di nascondere la colonna utente se il PM ha scelto di farlo
- Pulsante export PDF/Excel dal report pubblico per il cliente

### 3. Dialog condivisione migliorata

Nella dialog "Condividi" del `ProjectTimesheet`, aggiungere:
- Checkbox "Nascondi nomi utenti" (appende `&hide_users=1` al link)
- Preview del link generato con parametri

## Dettagli tecnici

| File | Modifica |
|------|----------|
| `src/components/ProjectTimesheet.tsx` | Aggiungere sezione riepilogo per attività; migliorare dialog condivisione con opzione hide_users |
| `src/pages/PublicTimesheet.tsx` | Aggiungere riepilogo aggregato per attività, supporto hide_users, export Excel/PDF |
| `supabase/functions/public-timesheet/index.ts` | Aggiungere `billing_type` e riepilogo aggregato per attività nel response; supporto param `hide_users` |

### Dati per il riepilogo per attività (interno)
Già disponibili: i `timeEntries` sono raggruppati per `budget_item_id` con `budget_items.activity_name` e `budget_items.category`. Per le ore previste serve fare un fetch dei `budget_items` con `hours_worked` — query già presente nel componente.

