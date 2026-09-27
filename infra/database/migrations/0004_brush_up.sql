-- Members and roles, a second kind of shift ending, urgent jobs, invitations,
-- closed months, per-store labor settings, anonymous shop feedback, worker
-- activity signals, letter replies, and the snapshot table the API uses today.

alter type public.shift_status add value if not exists 'cancelled';

-- Two roles are enough for the pilot: a manager decides and pays, staff punch and review.
alter table public.organization_members
  add column app_role text not null default 'staff' check (app_role in ('manager', 'staff'));

alter table public.job_postings
  add column urgent boolean not null default false,
  add column published_at timestamptz;

create table public.store_settings (
  store_id uuid primary key references public.stores(id) on delete cascade,
  break_rules jsonb not null default '[{"workedOverMinutes":480,"requiredBreakMinutes":60},{"workedOverMinutes":360,"requiredBreakMinutes":45}]'::jsonb,
  overtime_premium_rate numeric(4,3) not null default 0.25 check (overtime_premium_rate between 0 and 1),
  night_premium_rate numeric(4,3) not null default 0.25 check (night_premium_rate between 0 and 1),
  rounding_minutes smallint not null default 1 check (rounding_minutes in (1, 5, 10, 15, 30)),
  closing_day smallint not null default 0 check (closing_day between 0 and 28),
  updated_at timestamptz not null default now()
);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_posting_id uuid not null references public.job_postings(id) on delete cascade,
  worker_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'sent' check (status in ('sent', 'accepted', 'declined')),
  sent_at timestamptz not null default now(),
  responded_at timestamptz,
  unique (job_posting_id, worker_id)
);

create table public.closed_periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  month char(7) not null check (month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  closed_at timestamptz not null default now(),
  closed_by uuid not null references auth.users(id),
  unique (store_id, month)
);

-- Individual answers stay here; the API only ever returns averages over five or more workers.
create table public.shop_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  shift_id uuid not null unique references public.shifts(id) on delete cascade,
  worker_id uuid not null references auth.users(id) on delete cascade,
  break_ok smallint not null check (break_ok between 1 and 5),
  clear_instructions smallint not null check (clear_instructions between 1 and 5),
  friendly smallint not null check (friendly between 1 and 5),
  would_return boolean not null,
  submitted_at timestamptz not null default now()
);

create table public.worker_activities (
  id uuid primary key default gen_random_uuid(),
  worker_id uuid not null references auth.users(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  kind text not null check (kind in ('app_opened', 'island_visited')),
  occurred_at timestamptz not null default now()
);
create index worker_activities_worker_idx on public.worker_activities (worker_id, occurred_at);

-- Letters from the shop to a worker after a shift, and the stamp the worker sends back.
create table public.letters (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  shift_id uuid not null references public.shifts(id) on delete cascade,
  worker_id uuid not null references auth.users(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  template text not null,
  body text not null check (char_length(body) between 1 and 300),
  sent_at timestamptz not null default now(),
  reply_stamp text check (reply_stamp in ('thanks', 'see_you', 'fun')),
  replied_at timestamptz
);
create index letters_worker_idx on public.letters (worker_id, sent_at desc);

-- Until rows are written table by table, the API keeps its whole state here.
create table public.api_snapshots (
  id text primary key,
  snapshot jsonb not null,
  saved_at timestamptz not null default now()
);

alter table public.store_settings enable row level security;
alter table public.invitations enable row level security;
alter table public.closed_periods enable row level security;
alter table public.shop_feedback enable row level security;
alter table public.worker_activities enable row level security;
alter table public.letters enable row level security;
alter table public.api_snapshots enable row level security;
