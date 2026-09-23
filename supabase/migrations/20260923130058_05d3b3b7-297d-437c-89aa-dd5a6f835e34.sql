REVOKE ALL ON FUNCTION public.notify_retrospective_survey_request() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.can_manage_project_retrospective(uuid) FROM PUBLIC, anon;