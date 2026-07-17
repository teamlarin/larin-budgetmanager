## Problema

In Impostazioni → Utenti la query `supabase.from("profiles").select("*")` fallisce con "permission denied". Verifica sul DB:

```
has_table_privilege('authenticated','public.profiles','SELECT') → false
has_table_privilege('anon',          'public.profiles','SELECT') → true
has_table_privilege('service_role',  'public.profiles','SELECT') → true
```

Il ruolo `authenticated` non ha alcun privilegio (né a livello di tabella né di colonna) su `public.profiles`. È una regressione introdotta dalla recente migration di security hardening (`profiles_sensitive_columns_broad_select`): ha revocato la SELECT ampia senza ri-concedere i privilegi necessari al ruolo `authenticated`, quindi nessun utente loggato può più leggere i profili — nemmeno il proprio, anche se le RLS policy lo permetterebbero. Le policy RLS restano corrette; manca solo il GRANT a livello di Data-API.

Curiosità collaterale: `anon` ha ancora SELECT sulla tabella. Le policy filtrano comunque (nessuna policy `anon`-friendly), quindi non c'è leak, ma è un'incongruenza che vale la pena ripulire.

## Fix

Una migration che ripristina i GRANT corretti su `public.profiles`, coerenti con le RLS già in vigore:

```sql
-- 1) Concedi al ruolo authenticated i privilegi che le RLS filtrano già
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;

-- 2) service_role deve poter operare (edge functions/admin)
GRANT ALL ON public.profiles TO service_role;

-- 3) Rimuovi la SELECT ad anon: nessuna policy pubblica, quindi è solo rumore
REVOKE SELECT ON public.profiles FROM anon;
```

Non tocco le RLS policy (già corrette) né la logica di UserManagement.

## Verifica post-fix

1. `has_table_privilege('authenticated','public.profiles','SELECT')` → `true`
2. Ricarica **Impostazioni → Utenti** da admin: lista popolata, nessun toast di errore.
3. Da un utente non-admin la pagina Profilo continua a caricare il proprio record (RLS "Users can view their own profile").
4. Le edge functions che scrivono su `profiles` con `service_role` continuano a funzionare.

## Nota

Se in futuro vuoi restringere le colonne sensibili leggibili dal client, la strada corretta è una VIEW `profiles_public` con `security_invoker=on` che espone solo i campi non sensibili, non revocare i GRANT alla tabella base — la revoca rompe qualsiasi lettura RLS-compliant, come è successo qui.