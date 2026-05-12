## Piano

1. **Rendere il fallback sempre visibile nel dialog**
   - In `JethrIntegration.tsx` salverò anche `fallback_source` e `fallback_raw_count` restituiti da `jethr-list-employees`.
   - Il messaggio non dirà più solo “0 record grezzi dipendenti” quando le assenze sono disponibili: mostrerà anche quanti record sono stati letti da `presence-absence-requests`.

2. **Rendere il fallback più robusto lato Edge Function**
   - In `jethr-list-employees`, migliorerò l’estrazione dipendente dalle richieste assenza includendo varianti più profonde (`created_by`, `owner`, `applicant`, `profile`, `resource`, nested `employee/user`).
   - Normalizzerò meglio ID e nome per evitare che record validi vengano scartati perché l’ID è in una chiave diversa o annidata.

3. **Aggiungere una via di debug utile se Jethr non espone i dipendenti**
   - Se anche il fallback da assenze produce 0 dipendenti, il dialog mostrerà il conteggio delle assenze lette e l’anteprima del primo record fallback.
   - Questo permetterà di capire quale campo contiene davvero il dipendente senza dover indovinare dal messaggio generico.

## Verifica

- Chiamerò/deployerò la funzione `jethr-list-employees` e controllerò i log per confermare se ora vengono prodotti dipendenti dal fallback oppure se almeno appare il campione raw utile per il mapping.