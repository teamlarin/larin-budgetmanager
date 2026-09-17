# Pagina Progetti: il ruolo "member" vede solo i suoi progetti

## Obiettivo

Nella pagina **Progetti**, chi ha il ruolo *member* deve vedere solo i progetti in cui è nel team o è responsabile di progetto. Nessun altro progetto compare, nemmeno nei conteggi dei filtri, nelle statistiche in cima o nel numero di pagine.

## Stato attuale verificato

- Le regole di sicurezza del database sulla tabella progetti già limitano il ruolo *member* ai progetti dove è responsabile oppure presente nel team (verificato sulle policy attive).
- La pagina però non applica alcun filtro proprio: quando si osserva l'elenco "come member" dalla simulazione ruolo (disponibile agli amministratori), i dati arrivano con i permessi reali dell'amministratore e l'elenco resta completo. Lo stesso vale per qualunque percorso in cui il ruolo effettivo mostrato in interfaccia non coincide con quello del database.

## Cosa cambia

1. La pagina Progetti calcola l'insieme dei progetti "miei" per il ruolo member: responsabile di progetto oppure presente tra i membri del team.
2. Se il ruolo effettivo è *member*, l'elenco parte già filtrato su quell'insieme: filtri, ricerca, contatori di stato, statistiche e paginazione lavorano tutti sui soli progetti visibili.
3. Nessun cambiamento per gli altri ruoli e nessuna modifica alle regole di sicurezza del database (già corrette).

## Dettagli tecnici

- File: `src/pages/ApprovedProjects.tsx`.
- Nella query `approved-projects` viene già letto `project_members`: si aggiunge una mappa `project_id -> Set<user_id>` accanto a `teamMembersMap` (oggi contiene solo i nomi), esposta come `teamMemberIds` su ogni riga.
- Subito dopo `allProjects` si introduce `visibleProjects`: se il ruolo effettivo è `member`, filtra su `project_leader_id === currentUserId || teamMemberIds.includes(currentUserId)`; altrimenti resta `allProjects`. Tutti gli usi successivi (`activeProjects`, `statusWithCount`, statistiche, `projects`, paginazione) passano da `visibleProjects`.
- Il ruolo effettivo tiene conto della simulazione ruolo (`RoleSimulationContext`), così l'anteprima "come member" mostra lo stesso risultato di un member reale.
- Bump della `queryKey` da `v7` a `v8` per invalidare la cache esistente.
