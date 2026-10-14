create table public.budget_section_titles (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references public.budgets(id) on delete cascade,
  budget_template_id uuid references public.budget_templates(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index budget_section_titles_budget_template_uniq
  on public.budget_section_titles (
    budget_id,
    coalesce(budget_template_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

grant select, insert, update, delete on public.budget_section_titles to authenticated;
grant all on public.budget_section_titles to service_role;

alter table public.budget_section_titles enable row level security;

create policy "Approved users can manage budget section titles"
  on public.budget_section_titles
  for all
  to authenticated
  using (public.is_approved_user(auth.uid()))
  with check (public.is_approved_user(auth.uid()));

create trigger set_budget_section_titles_updated_at
  before update on public.budget_section_titles
  for each row execute function public.update_updated_at_column();