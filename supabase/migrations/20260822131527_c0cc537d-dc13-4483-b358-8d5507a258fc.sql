REVOKE ALL ON FUNCTION public.set_first_offer_version_as_current() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_next_offer_number() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_next_offer_version_number() FROM PUBLIC, anon, authenticated;
ALTER FUNCTION public.assert_offer_transition_actor(public.offer_status, public.offer_event_actor_type) SET search_path = public;
ALTER FUNCTION public.assert_offer_transition_allowed(public.offer_status, public.offer_status) SET search_path = public;