# Rendere visibile Meccanostampi nell’anagrafica clienti

## Stato verificato
- Nel database esistono sia **“Meccanostampi s.r.l.”** sia **“Meccanostampi SRL”**.
- “Meccanostampi s.r.l.” è il cliente n. **1089 su 1813** nell’ordinamento alfabetico.
- Il problema segnalato riguarda **Impostazioni > Clienti**.

## Intervento
1. Modificare l’anagrafica clienti per eseguire ricerca, filtri, ordinamento e paginazione direttamente su Supabase, richiedendo soltanto la pagina necessaria e il conteggio totale.
2. Rendere la ricerca per nome, email e telefono indipendente dal limite di 1.000 righe, così “Meccanostampi s.r.l.” viene trovato immediatamente anche se si trova oltre la prima pagina restituita dall’API.
3. Mantenere invariati i filtri per livello strategico e account, azzerando correttamente la pagina quando cambiano ricerca o filtri.
4. Verificare nella preview autenticata che cercando “Meccanostampi” compaiano entrambi i record e che paginazione, conteggio e ordinamento continuino a funzionare.

## Dettagli tecnici
- Nessuna modifica al database o alle policy RLS.
- La correzione sarà limitata a `ClientManagement` e, se utile, a un piccolo helper di query condiviso.
- Le azioni esistenti di modifica, eliminazione, unione e gestione contatti resteranno invariate.