begin;
create or replace function public.stock_save_orders(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare item jsonb;
begin
 if jsonb_typeof(payload->'items')<>'array' or jsonb_array_length(payload->'items')<1 then raise exception 'Empty order batch' using errcode='22023';end if;
 for item in select value from jsonb_array_elements(payload->'items') order by value->>'id' loop
  perform migration_stock.order_write((item->>'id')::uuid,item->'data',(item->>'revision')::integer);
 end loop;
 return jsonb_build_object('success',true);
end $$;
revoke all on function public.stock_save_orders(jsonb) from public,anon,authenticated;
grant execute on function public.stock_save_orders(jsonb) to service_role;
notify pgrst,'reload schema';
commit;
