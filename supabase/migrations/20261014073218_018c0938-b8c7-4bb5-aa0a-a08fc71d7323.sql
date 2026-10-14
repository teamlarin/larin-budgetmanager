CREATE OR REPLACE FUNCTION public.sync_external_cost_to_project()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner uuid;
BEGIN
  IF NEW.project_id IS NULL OR NOT COALESCE(NEW.is_external_cost, false) THEN
    RETURN NEW;
  END IF;
  SELECT user_id INTO v_owner FROM public.projects WHERE id = NEW.project_id;
  IF v_owner IS NULL THEN RETURN NEW; END IF;
  INSERT INTO public.project_additional_costs (project_id, name, description, amount, supplier_id, user_id, source_budget_item_id)
  VALUES (NEW.project_id, NEW.activity_name,
          'Da budget: costo ' || COALESCE(NEW.external_cost_base,0) || ' € con ricarico ' || COALESCE(NEW.external_cost_markup,30) || '%',
          COALESCE(NEW.external_cost_base, 0), NEW.supplier_id, COALESCE(auth.uid(), v_owner), NEW.id)
  ON CONFLICT (project_id, source_budget_item_id) WHERE source_budget_item_id IS NOT NULL DO NOTHING;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_external_cost_to_project() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_sync_external_cost_to_project ON public.budget_items;
CREATE TRIGGER trg_sync_external_cost_to_project
AFTER INSERT OR UPDATE OF project_id, is_external_cost ON public.budget_items
FOR EACH ROW EXECUTE FUNCTION public.sync_external_cost_to_project();