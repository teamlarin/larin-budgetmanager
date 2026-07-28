
-- 1) Hide compensation columns on profiles from authenticated role
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, email, full_name, created_at, updated_at, approved, first_name, last_name, avatar_url, deleted_at, target_productivity_percentage, title, area, level_id) ON public.profiles TO authenticated;

-- 2) Revoke EXECUTE on all public SECURITY DEFINER functions from PUBLIC, anon, authenticated
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS s, p.proname AS f,
           pg_catalog.pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION public.%I(%s) FROM PUBLIC, anon, authenticated;', r.f, r.args);
  END LOOP;
END $$;

-- 3) Re-grant EXECUTE to authenticated only for functions the client / RLS truly need
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_approved_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_editor_or_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_update_project_progress(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_manage_workflow_templates(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profiles_compensation(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_hourly_rates_for_costing(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profiles_by_roles(app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_email_preference(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_hourly_rate_at_date(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_cron_jobs_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_manual_invocations(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_run_cron_job_now(bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.merge_clients(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_completely(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_all_pack_projects_progress() TO authenticated;

-- 4) Block anonymous (is_anonymous JWT) users from workflow_templates policies
DROP POLICY IF EXISTS "Authenticated users can read templates" ON public.workflow_templates;
DROP POLICY IF EXISTS "Workflow managers can insert templates" ON public.workflow_templates;
DROP POLICY IF EXISTS "Workflow managers can update templates" ON public.workflow_templates;
DROP POLICY IF EXISTS "Workflow managers can delete templates" ON public.workflow_templates;

CREATE POLICY "Authenticated users can read templates"
ON public.workflow_templates FOR SELECT TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
);

CREATE POLICY "Workflow managers can insert templates"
ON public.workflow_templates FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND public.can_manage_workflow_templates(auth.uid())
);

CREATE POLICY "Workflow managers can update templates"
ON public.workflow_templates FOR UPDATE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND public.can_manage_workflow_templates(auth.uid())
)
WITH CHECK (
  auth.uid() IS NOT NULL
  AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND public.can_manage_workflow_templates(auth.uid())
);

CREATE POLICY "Workflow managers can delete templates"
ON public.workflow_templates FOR DELETE TO authenticated
USING (
  auth.uid() IS NOT NULL
  AND COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, false) = false
  AND public.can_manage_workflow_templates(auth.uid())
);
