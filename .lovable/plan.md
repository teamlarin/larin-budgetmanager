

# Implementazione miglioramenti tab "Canvas e Attività"

Escluso il punto 1 (Header di contesto rapido) come richiesto. Implementeremo i punti 2, 3 e 4.

## Modifiche in `src/components/ProjectActivitiesManager.tsx`

### 2. Card "Brief & Obiettivi" ripensata
- Passare `secondaryObjective` come nuova prop dal ProjectCanvas
- **Brief**: link prominente con icona e stato visivo (presente/mancante), stessa logica DriveFilePicker attuale
- **Obiettivi**: mostrati come badge colorati (primario e secondario) invece di testo piatto; mappare i valori agli stessi label usati nel select di ProjectCanvas
- **Descrizione**: wrappata in un `Collapsible` (aperta di default solo se presente), per risparmiare spazio

### 3. Riepilogo avanzamento attività (nuovo)
Tra la card Brief e la card Attività, aggiungere una barra di riepilogo:
- Contatore attività: totale, assegnate, con ore confermate
- **Barra di progresso ore**: ore confermate vs ore previste (da `activity_time_tracking` con `actual_start_time && actual_end_time` non null, calcolando le ore con `calculateSafeHours`)
- Query aggiuntiva: fetch di tutti i record `activity_time_tracking` per i budget_item_id del progetto dove `actual_start_time` e `actual_end_time` sono non null, per aggregare le ore confermate per attività

### 4. Colonna "ore confermate" per ogni attività
- Per ogni riga attività, accanto alle ore previste, mostrare `Xh / Yh` dove X = ore confermate e Y = ore previste
- Mini progress bar inline (sottile, sotto la riga ore)
- Dati provengono dalla stessa query del punto 3, raggruppati per `budget_item_id`

## Modifiche in `src/pages/ProjectCanvas.tsx`
- Passare `secondaryObjective={(project as any).secondary_objective}` come prop a `ProjectActivitiesManager`

## File coinvolti
| File | Modifica |
|------|----------|
| `src/components/ProjectActivitiesManager.tsx` | Nuova prop, card brief ristrutturata, riepilogo avanzamento, ore confermate per attività |
| `src/pages/ProjectCanvas.tsx` | Passaggio prop `secondaryObjective` |

