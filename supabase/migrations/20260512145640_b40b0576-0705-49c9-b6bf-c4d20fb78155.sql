
create table if not exists public.jethr_activity_mappings (
  jethr_type text primary key,
  budget_item_id uuid not null references public.budget_items(id) on delete cascade,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.jethr_activity_mappings enable row level security;

create policy "Admin read jethr_activity_mappings"
  on public.jethr_activity_mappings for select
  using (public.has_role(auth.uid(), 'admin'));
create policy "Admin write jethr_activity_mappings"
  on public.jethr_activity_mappings for all
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create table if not exists public.jethr_absence_tracking (
  jethr_id text not null,
  scheduled_date date not null,
  tracking_id uuid not null references public.activity_time_tracking(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (jethr_id, scheduled_date)
);
create index if not exists idx_jethr_absence_tracking_tracking on public.jethr_absence_tracking(tracking_id);
alter table public.jethr_absence_tracking enable row level security;

create policy "Admin read jethr_absence_tracking"
  on public.jethr_absence_tracking for select
  using (public.has_role(auth.uid(), 'admin'));
