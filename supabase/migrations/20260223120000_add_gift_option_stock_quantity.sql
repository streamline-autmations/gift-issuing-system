begin;

alter table public.gift_options
add column if not exists stock_quantity integer;

alter table public.gift_options
add constraint gift_options_stock_quantity_nonnegative
check (stock_quantity is null or stock_quantity >= 0);

commit;

