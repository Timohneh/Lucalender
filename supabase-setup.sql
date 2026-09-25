create table if not exists public.bookings (
  booking_date date primary key,
  person text not null check (person in ('anka', 'gabel')),
  note text not null default '' check (char_length(note) <= 38),
  updated_at timestamptz not null default now()
);

alter table public.bookings enable row level security;

drop policy if exists "Lucalender ist für Linkbesitzer lesbar" on public.bookings;
create policy "Lucalender ist für Linkbesitzer lesbar"
on public.bookings for select to anon using (true);

drop policy if exists "Lucalender ist für Linkbesitzer buchbar" on public.bookings;
create policy "Lucalender ist für Linkbesitzer buchbar"
on public.bookings for insert to anon with check (true);

drop policy if exists "Lucalender-Buchungen sind änderbar" on public.bookings;
create policy "Lucalender-Buchungen sind änderbar"
on public.bookings for update to anon using (true) with check (true);

drop policy if exists "Lucalender-Buchungen sind löschbar" on public.bookings;
create policy "Lucalender-Buchungen sind löschbar"
on public.bookings for delete to anon using (true);

create or replace function public.enforce_luca_quota()
returns trigger
language plpgsql
as $$
declare
  booking_count integer;
  booking_limit integer;
begin
  booking_limit := case when new.person = 'anka' then 5 else 3 end;
  select count(*) into booking_count
  from public.bookings
  where person = new.person
    and date_trunc('month', booking_date) = date_trunc('month', new.booking_date)
    and booking_date <> new.booking_date;

  if booking_count >= booking_limit then
    raise exception 'Kontingent für % ist in diesem Monat aufgebraucht.', initcap(new.person);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists check_luca_quota on public.bookings;
create trigger check_luca_quota
before insert or update on public.bookings
for each row execute function public.enforce_luca_quota();
