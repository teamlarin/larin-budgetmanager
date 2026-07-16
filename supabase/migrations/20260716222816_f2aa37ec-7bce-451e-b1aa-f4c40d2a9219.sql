
CREATE OR REPLACE FUNCTION public.execute_readonly_query(query_text text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
DECLARE
  result jsonb;
  lower_query text;
BEGIN
  lower_query := lower(trim(query_text));
  IF NOT (lower_query LIKE 'select%' OR lower_query LIKE 'with%') THEN
    RAISE EXCEPTION 'Solo query SELECT sono permesse';
  END IF;
  IF lower_query ~ '\y(delete|drop|insert|update|alter|truncate|create|grant|revoke)\y' THEN
    RAISE EXCEPTION 'Query non permessa: contiene operazioni di scrittura';
  END IF;
  EXECUTE 'SELECT jsonb_agg(row_to_json(t)) FROM (' || query_text || ') t' INTO result;
  RETURN COALESCE(result, '[]'::jsonb);
END;
$function$;

REVOKE ALL ON FUNCTION public.execute_readonly_query(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_readonly_query(text) TO authenticated;

REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, email, full_name, first_name, last_name, avatar_url,
  title, area, level_id, approved, deleted_at,
  target_productivity_percentage, created_at, updated_at
) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

DROP POLICY IF EXISTS "Authenticated users can read templates" ON public.workflow_templates;
DROP POLICY IF EXISTS "Workflow managers can delete templates" ON public.workflow_templates;
DROP POLICY IF EXISTS "Workflow managers can insert templates" ON public.workflow_templates;
DROP POLICY IF EXISTS "Workflow managers can update templates" ON public.workflow_templates;

CREATE POLICY "Authenticated users can read templates"
  ON public.workflow_templates FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL AND public.is_approved_user(auth.uid()));

CREATE POLICY "Workflow managers can insert templates"
  ON public.workflow_templates FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND public.can_manage_workflow_templates(auth.uid()));

CREATE POLICY "Workflow managers can update templates"
  ON public.workflow_templates FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL AND public.can_manage_workflow_templates(auth.uid()));

CREATE POLICY "Workflow managers can delete templates"
  ON public.workflow_templates FOR DELETE
  TO authenticated
  USING (auth.uid() IS NOT NULL AND public.can_manage_workflow_templates(auth.uid()));
