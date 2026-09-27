-- The shop island as the worker app draws it: reviews are stars plus tags, one
-- landmark per tag grown by vote counts, and the shop decides only its looks.

alter table public.stores
  add column logo_url text,
  add column sign_color char(7) not null default '#8b7bff' check (sign_color ~ '^#[0-9a-fA-F]{6}$'),
  add column accent_color char(7) not null default '#f7f3ff' check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  add column values_line text not null default '' check (char_length(values_line) <= 80);

alter table public.shop_feedback
  drop column break_ok,
  drop column clear_instructions,
  drop column friendly,
  drop column would_return,
  add column stars smallint not null default 4 check (stars between 1 and 5),
  add column tags text[] not null default '{}'
    check (tags <@ array['on_time', 'breaks', 'instructions', 'paid', 'friendly', 'fair', 'again']::text[]);
