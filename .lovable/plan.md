# Riorganizzazione del Cruscotto vendite

## Cosa cambierà

### Tab Vendite
Raccoglierà le analisi commerciali già presenti:
- venduto totale e offerte accettate;
- venduto per categoria;
- classifica prodotti;
- mix del venduto ricorrente / una tantum;
- conversione delle offerte;
- venduto per commerciale.

### Tab Fatturato
Raccoglierà gli indicatori economici:
- fatturato effettivo, previsto e target;
- MRR, ARR e ricavi a rischio;
- margine di profitto per progetto o cliente.

Il selettore dell’anno resterà comune alle due tab.

## Tabella Margine di profitto

- Mostrare al massimo **10 righe per pagina**, mantenendo accessibili gli altri risultati tramite paginazione.
- Aggiungere una ricerca che filtri per nome progetto e cliente; nella vista “Per cliente” cercherà il nome cliente.
- Applicare ricerca, ordinamento e paginazione in modo coerente: prima filtro, poi ordinamento, infine pagina da 10 risultati.
- Azzerare la pagina quando cambiano ricerca, vista o ordinamento.
- Escludere dalla marginalità:
  - tutti i progetti con area `interno`;
  - i clienti **Larin Group** e **Larin Srl**.
- Mostrare uno stato chiaro quando la ricerca non produce risultati.

## Dettagli tecnici

- Usare le tab già presenti nel sistema, mantenendo caricate solo le sezioni visibili quando possibile.
- Rafforzare il filtro dei progetti interni già presente nella lettura dati e applicare l’esclusione dei due clienti tramite i loro identificativi, evitando confronti fragili sul testo visualizzato.
- Non modificare formule, dati o permessi della marginalità.

## Verifica finale

- Controllare contenuti e cambio tab su desktop e mobile.
- Verificare ricerca, ordinamento, cambio vista progetto/cliente e paginazione a 10 righe.
- Confermare che progetti interni, Larin Group e Larin Srl non compaiano nella marginalità.
- Eseguire test e controllo di compilazione.
