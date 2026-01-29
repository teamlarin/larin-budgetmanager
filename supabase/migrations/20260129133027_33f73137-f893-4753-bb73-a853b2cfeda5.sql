-- Insert sample action logs for today (January 29, 2026) to simulate earlier activity
INSERT INTO public.user_action_logs (user_id, action_type, action_description, entity_type, entity_id, metadata, created_at)
SELECT 
  p.id as user_id,
  'login' as action_type,
  'Login effettuato' as action_description,
  NULL as entity_type,
  NULL as entity_id,
  '{}' as metadata,
  '2026-01-29 08:30:00+00'::timestamptz as created_at
FROM public.profiles p
WHERE p.deleted_at IS NULL
LIMIT 3;

INSERT INTO public.user_action_logs (user_id, action_type, action_description, entity_type, entity_id, metadata, created_at)
SELECT 
  p.id as user_id,
  'view' as action_type,
  'Visualizzazione dashboard' as action_description,
  NULL as entity_type,
  NULL as entity_id,
  '{}' as metadata,
  '2026-01-29 08:35:00+00'::timestamptz as created_at
FROM public.profiles p
WHERE p.deleted_at IS NULL
LIMIT 3;

INSERT INTO public.user_action_logs (user_id, action_type, action_description, entity_type, entity_id, metadata, created_at)
SELECT 
  p.id as user_id,
  'update' as action_type,
  'Modifica profilo utente' as action_description,
  'user' as entity_type,
  p.id as entity_id,
  '{}' as metadata,
  '2026-01-29 09:15:00+00'::timestamptz as created_at
FROM public.profiles p
WHERE p.deleted_at IS NULL
LIMIT 2;

INSERT INTO public.user_action_logs (user_id, action_type, action_description, entity_type, entity_id, metadata, created_at)
SELECT 
  p.id as user_id,
  'create' as action_type,
  'Creazione nuovo progetto' as action_description,
  'project' as entity_type,
  gen_random_uuid() as entity_id,
  '{"project_name": "Progetto Demo"}' as metadata,
  '2026-01-29 10:00:00+00'::timestamptz as created_at
FROM public.profiles p
WHERE p.deleted_at IS NULL
LIMIT 2;

INSERT INTO public.user_action_logs (user_id, action_type, action_description, entity_type, entity_id, metadata, created_at)
SELECT 
  p.id as user_id,
  'export' as action_type,
  'Esportazione report budget' as action_description,
  'budget' as entity_type,
  NULL as entity_id,
  '{}' as metadata,
  '2026-01-29 11:30:00+00'::timestamptz as created_at
FROM public.profiles p
WHERE p.deleted_at IS NULL
LIMIT 1;