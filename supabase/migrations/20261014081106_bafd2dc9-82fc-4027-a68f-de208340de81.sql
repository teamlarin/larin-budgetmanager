drop index if exists public.budget_section_titles_budget_template_uniq;

create unique index budget_section_titles_budget_template_uniq
  on public.budget_section_titles (budget_id, budget_template_id) nulls not distinct;