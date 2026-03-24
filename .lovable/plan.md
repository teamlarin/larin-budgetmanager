

## Saldo Anno: escludere il mese corrente e indicare aggiornamento

### Problema
Il Saldo Anno nella Banca Ore del profilo include il mese corrente (ancora in corso), rendendo il dato fuorviante.

### Soluzione

**File: `src/components/ProfileHoursBank.tsx`**

1. **Calcolo YTD senza mese corrente**: filtrare `rows` escludendo il mese corrente nei totali YTD:
   ```
   const currentMonthKey = format(now, 'yyyy-MM');
   const ytdRows = rows.filter(r => r.key !== currentMonthKey);
   const ytdConfirmed = ytdRows.reduce(...)
   const ytdExpected = ytdRows.reduce(...)
   const ytdBalance = ytdConfirmed - ytdExpected + carryover
   ```
   Se l'anno selezionato è passato (non l'anno corrente), includere tutti i mesi come oggi.

2. **Indicazione aggiornamento**: sotto il valore "Saldo Anno" nella stat card, aggiungere una riga in piccolo: `"Aggiornato a {mese precedente}"` (es. "Aggiornato a febbraio").

3. **Riga totale tabella**: la riga "Saldo Anno Finale" in fondo alla tabella usa gli stessi totali filtrati. La label diventa "Saldo Anno (agg. a febbraio)".

4. **Export CSV**: stessa logica — il totale YTD e il Saldo Anno Finale escludono il mese corrente.

### Dettagli tecnici
- La condizione si applica solo se `selectedYear === now.getFullYear()` e il mese corrente è > gennaio
- Se siamo a gennaio, il saldo anno è vuoto/zero (nessun mese completato)
- I saldi mensili nella tabella restano invariati (incluso il mese corrente)

