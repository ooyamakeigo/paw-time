-- Breaks are punched like check-ins, and a correction is a new event that
-- points at the one it replaces, so the original punch is never lost.
alter type public.attendance_event_kind add value if not exists 'break_start';
alter type public.attendance_event_kind add value if not exists 'break_end';

alter table public.attendance_events
  add column correction_of_event_id uuid references public.attendance_events(id) on delete restrict,
  add column note text;

create index attendance_events_correction_idx
  on public.attendance_events (correction_of_event_id)
  where correction_of_event_id is not null;
