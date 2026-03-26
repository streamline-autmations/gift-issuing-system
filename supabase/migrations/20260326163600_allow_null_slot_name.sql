-- Make gift_slots name column nullable to allow anonymous slots

alter table public.gift_slots
alter column name drop not null;