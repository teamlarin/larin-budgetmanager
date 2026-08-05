# Riorganizzazione tab del profilo

## Obiettivo
Separare i dati personali dalle impostazioni tecniche nella pagina "Il Mio Profilo".

## Nuova struttura tab
```text
Profilo | Impostazioni | Notifiche* | Banca Ore | Performance
```
*Le notifiche vengono spostate dentro "Impostazioni", quindi la tab dedicata sparisce.

Struttura finale: **Profilo | Impostazioni | Banca Ore | Performance**

### Tab "Profilo" (ex "Impostazioni")
- Foto Profilo
- Informazioni Personali
- Scheda persona (dati HR, bio, skills, interessi, lingue)

### Tab "Impostazioni" (nuova)
- Account Google (collega/scollega)
- Sicurezza e accesso (password, reset via email)
- Preferenze Notifiche (in-app / email, tutti i gruppi esistenti)

## Dettagli tecnici
- `src/pages/Profile.tsx`: rinomino il valore tab `settings` in `profile` (icona User) e creo un nuovo `TabsContent value="settings"` (icona Settings).
- Sposto i blocchi Card "Account Google" e "Sicurezza e accesso" dal tab profilo al nuovo tab impostazioni; sposto dentro lo stesso tab il contenuto della vecchia sezione Notifiche e rimuovo il relativo `TabsTrigger`.
- `TabsList` passa da `grid-cols-4` a `grid-cols-4` invariato nel numero (Profilo, Impostazioni, Banca Ore, Performance).
- Nessuna modifica a logica, query o database: solo riorganizzazione della UI.
