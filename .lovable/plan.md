# Raggruppare le voci di finanza sotto un menu principale

## Obiettivo
Nel menu principale dell'app, raggruppare le voci:
- Cruscotto (/sales)
- Fatture (/invoices)
- Abbonamenti (/subscriptions)
- Gare (/tenders)

sotto una singola voce principale **"Finanza"**, accessibile tramite dropdown.

## Stato attuale
In `src/components/AppHeader.tsx` le quattro voci sono renderizzate come `NavLink` orizzontali separati, ciascuno con la propria icona e permessi:
- Fatture, Abbonamenti, Cruscotto visibili a `admin`/`account`/`finance`
- Gare visibile solo a `admin`

Le rotte in `src/App.tsx` rimarranno invariate.

## Piano di intervento

### 1. Sostituire i quattro NavLink con un dropdown "Finanza"
In `src/components/AppHeader.tsx`:
- Rimuovere i quattro `NavLink` attuali (Fatture, Abbonamenti, Gare, Cruscotto).
- Aggiungere un componente `DropdownMenu` con trigger stile NavLink (icona + label "Finanza" + chevron).
- All'interno del dropdown inserire le voci:
  - Cruscotto → `/sales`
  - Fatture → `/invoices`
  - Abbonamenti → `/subscriptions`
  - Gare → `/tenders` (solo admin)

### 2. Permessi
- La voce principale "Finanza" sarà visibile a chi può vedere almeno una delle sotto-voci (`isAdmin || effectiveRole === 'finance'`).
- All'interno del dropdown, "Gare" rimarrà visibile solo a `isAdmin`.

### 3. Stato attivo composito
La voce "Finanza" dovrà apparire evidenziata quando l'utente si trova su una delle route `/sales`, `/invoices`, `/subscriptions`, `/tenders`.

### 4. Icona
Utilizzare l'icona `Wallet` (o equivalente del design system) per la voce principale. Ogni sotto-voce mantiene la propria icona esistente.

### 5. Verifica
- Controllare che il dropdown non rompa il layout responsive della navbar.
- Verificare che i permessi e gli stati attivi funzionino correttamente per i diversi ruoli.
