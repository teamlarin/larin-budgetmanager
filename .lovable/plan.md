

## Problema

L'utente esterno vede "Account in Attesa di Approvazione" perché `AppLayout.tsx` (riga 105) controlla `profiles.approved`, che di default è `false`. Gli utenti esterni non dovrebbero richiedere approvazione admin — il loro accesso è già gestito tramite `external_project_access`.

## Soluzione

Modificare `AppLayout.tsx` riga 105: se il ruolo è `external`, considerare l'utente come approvato automaticamente, bypassando il check `approved`.

```typescript
// Prima
setIsApproved(profileData?.approved || false);

// Dopo  
setIsApproved(profileData?.approved || role === 'external');
```

Un singolo cambiamento di una riga. Nessun altro file da modificare.

### Dettagli tecnici

La sicurezza resta garantita perché:
- L'utente external vede solo i progetti assegnati in `external_project_access` (RLS)
- La navigazione è già ridotta (solo Calendario e Progetti)
- Budget/preventivi sono nascosti sia a livello UI che RLS

