CREATE OR REPLACE FUNCTION public.merge_clients(
  keep_id uuid,
  drop_id uuid,
  final_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_keep RECORD;
  v_drop RECORD;
  v_moved_budgets int := 0;
  v_moved_projects int := 0;
  v_moved_payment_splits int := 0;
  v_moved_contact_links int := 0;
  v_moved_legacy_contacts int := 0;
BEGIN
  -- Authz: only admins
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Solo gli amministratori possono unire clienti';
  END IF;

  IF keep_id = drop_id THEN
    RAISE EXCEPTION 'I due clienti devono essere diversi';
  END IF;

  SELECT * INTO v_keep FROM public.clients WHERE id = keep_id;
  IF v_keep IS NULL THEN
    RAISE EXCEPTION 'Cliente da mantenere non trovato';
  END IF;

  SELECT * INTO v_drop FROM public.clients WHERE id = drop_id;
  IF v_drop IS NULL THEN
    RAISE EXCEPTION 'Cliente da eliminare non trovato';
  END IF;

  -- Reassign FK references
  UPDATE public.budgets SET client_id = keep_id WHERE client_id = drop_id;
  GET DIAGNOSTICS v_moved_budgets = ROW_COUNT;

  UPDATE public.projects SET client_id = keep_id WHERE client_id = drop_id;
  GET DIAGNOSTICS v_moved_projects = ROW_COUNT;

  UPDATE public.client_payment_splits SET client_id = keep_id WHERE client_id = drop_id;
  GET DIAGNOSTICS v_moved_payment_splits = ROW_COUNT;

  -- Move contact links (avoid duplicate (contact_id, client_id) pairs if any)
  INSERT INTO public.client_contact_clients (contact_id, client_id)
  SELECT contact_id, keep_id
  FROM public.client_contact_clients
  WHERE client_id = drop_id
  ON CONFLICT DO NOTHING;
  DELETE FROM public.client_contact_clients WHERE client_id = drop_id;
  GET DIAGNOSTICS v_moved_contact_links = ROW_COUNT;

  -- Legacy/direct contacts (if any rows reference clients.id directly)
  UPDATE public.client_contacts SET client_id = keep_id WHERE client_id = drop_id;
  GET DIAGNOSTICS v_moved_legacy_contacts = ROW_COUNT;

  -- Fill missing fields on the kept client from the dropped one
  UPDATE public.clients
  SET
    email = COALESCE(NULLIF(v_keep.email, ''), v_drop.email),
    phone = COALESCE(NULLIF(v_keep.phone, ''), v_drop.phone),
    notes = CASE
      WHEN COALESCE(v_keep.notes, '') = '' THEN v_drop.notes
      WHEN COALESCE(v_drop.notes, '') = '' THEN v_keep.notes
      WHEN v_keep.notes = v_drop.notes THEN v_keep.notes
      ELSE v_keep.notes || E'\n---\n' || v_drop.notes
    END,
    default_payment_terms = COALESCE(v_keep.default_payment_terms, v_drop.default_payment_terms),
    drive_folder_id = COALESCE(v_keep.drive_folder_id, v_drop.drive_folder_id),
    drive_folder_name = COALESCE(v_keep.drive_folder_name, v_drop.drive_folder_name),
    account_user_id = COALESCE(v_keep.account_user_id, v_drop.account_user_id),
    strategic_level = COALESCE(v_keep.strategic_level, v_drop.strategic_level),
    fic_id = COALESCE(v_keep.fic_id, v_drop.fic_id),
    name = COALESCE(NULLIF(final_name, ''), v_keep.name)
  WHERE id = keep_id;

  -- Finally delete the duplicate
  DELETE FROM public.clients WHERE id = drop_id;

  RETURN jsonb_build_object(
    'kept_id', keep_id,
    'dropped_id', drop_id,
    'moved_budgets', v_moved_budgets,
    'moved_projects', v_moved_projects,
    'moved_payment_splits', v_moved_payment_splits,
    'moved_contact_links', v_moved_contact_links,
    'moved_legacy_contacts', v_moved_legacy_contacts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.merge_clients(uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_clients(uuid, uuid, text) TO authenticated;