# Riferimento al budget nell'offerta e categorie prodotto allineate a Fatture in Cloud

Due correzioni separate: nella scheda dell'offerta manca il collegamento al budget da cui è nata, e nel form prodotto la categoria si scegli ancora da un vecchio elenco interno invece che dalle categorie che arrivano da Fatture in Cloud.

## 1. Riferimento al budget nella scheda offerta

Oggi l'offerta legge già il budget di origine (serve per il pulsante "Crea progetto"), ma non lo mostra mai.

- Nell'intestazione dell'offerta, accanto a cliente e progetto, compare **"Budget: <nome budget>"** come link cliccabile quando l'offerta nasce da un budget.
- Il link porta alla pagina del budget/progetto di origine, così da passare da offerta a budget in un clic.
- Se l'offerta non nasce da un budget (offerta commerciale creata a mano o gara) non compare nulla, come oggi.

## 2. Categoria prodotto: solo categorie di Fatture in Cloud

Il sync notturno scrive nei prodotti la categoria proveniente da Fatture in Cloud, ma il form di modifica prodotto propone un elenco di categorie interne (vecchie categorie/sottocategorie) che non c'entrano: salvando si sovrascrive la categoria FiC con un valore inesistente in FiC.

- Nel form prodotto la categoria diventa una scelta tra le **categorie realmente presenti nel listino** (quelle arrivate da Fatture in Cloud), con possibilità di scriverne una nuova solo per i prodotti creati a mano in TimeTrap.
- Il vecchio elenco di categorie/sottocategorie interne non viene più proposto da nessuna parte del listino.
- Nessun dato viene cancellato: le categorie storiche restano nel database, semplicemente non si usano più per i prodotti.

## Dettagli tecnici

**Offerta → budget**
- `src/pages/OfferDetail.tsx`: la query offerta (riga ~109) aggiunge `budgets:budget_id (id, name, project_id)`; nell'intestazione (riga ~561) si aggiunge un `Link` a `/projects/{budget.project_id}` (fallback `/budgets` se il budget non ha ancora un progetto), etichetta "Budget: {name}".
- Nessuna migration: `offers.budget_id` esiste già ed è già letto.

**Categoria prodotto**
- `src/components/ProductFormDialog.tsx`: sostituire `CategorySelect` con un select alimentato dai valori distinti di `products.category` (stessa fonte già usata dal filtro in `ProductManagement.tsx`, riga ~78) più opzione "Altra categoria…" con input libero. Lo schema zod resta con categoria obbligatoria.
- Rimuovere `src/components/CategorySelect.tsx` e l'hook `src/hooks/useProductServiceCategories.ts` se non usati altrove.
- `revenue_category` resta come oggi: valorizzata dal sync FiC (`fic-adapter` riga ~540) e modificabile sulle righe d'offerta.
- Nessuna migration: `product_service_categories` / `product_service_subcategories` restano nel database come archivio.

**Verifica**
- Build e typecheck puliti, nessun import rotto.
- Aprire un'offerta generata da budget approvato e controllare il link al budget; aprire un prodotto sincronizzato e verificare che la categoria mostrata/salvata sia quella di Fatture in Cloud.
