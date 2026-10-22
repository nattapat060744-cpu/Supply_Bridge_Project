-- Temporary service-role-only HTTP regression probe. Every test write rolls back.
-- Install with SQL Editor, run node supabase/verify_save_http.mjs, then remove:
-- DROP FUNCTION public.stock_verify_save_probe(); NOTIFY pgrst,'reload schema';
create or replace function public.stock_verify_save_probe() returns jsonb
language plpgsql security definer set search_path='' as $$
declare fixture uuid:=gen_random_uuid(); stage text:='create'; error_code text; completed boolean:=false; conflict_rejected boolean:=false; v bigint;
begin
 begin
  perform public.stock_bridge('insert',jsonb_build_object('table','Orders','rows',jsonb_build_array(jsonb_build_object(
   'Row_UID',fixture,'Group_ID','__save_http_probe__','Product_ID','__save_http_product__','Product_Name','Save regression probe','Supplier','__save_http_supplier__','Status','PENDING','Shop_Qty',1,'Stock_Qty',0,'Created_At','2026-10-22T15:00:00+07:00'))));
  stage:='purchase';
  perform public.stock_save_orders(jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',fixture,'revision',(select revision from migration_stock.orders where id=fixture),'data',jsonb_build_object('Status','ORDERED','Order_Carton',2,'Qty_Per_Carton',12,'Note_Purchase','Regression probe','Note_Stock','','Created_At_P','2026-10-22T15:00:00+07:00')))));
  stage:='receipt';
  perform public.stock_save_orders(jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',fixture,'revision',(select revision from migration_stock.orders where id=fixture),'data',jsonb_build_object('Status','COMPLETED','Recv_Carton',2,'Recv_Qty',24,'Receiver_Name','Regression probe','Recv_Date','2026-10-22T15:00:00+07:00')))));
  stage:='cache invalidation';
  select revision into v from migration_stock.read_epoch where id=1;
  insert into migration_stock.read_cache values('__save_http_probe__',v,'[]');
  perform public.stock_save_orders(jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',fixture,'revision',(select revision from migration_stock.orders where id=fixture),'data','{"Note_Purchase":"Updated probe"}'::jsonb))));
  if exists(select 1 from migration_stock.read_cache where cache_key='__save_http_probe__') then raise exception 'Cache not invalidated';end if;
  stage:='stale revision';
  begin
   perform public.stock_save_orders(jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',fixture,'revision',-1,'data','{"Status":"ORDERED"}'::jsonb))));
  exception when sqlstate 'PT409' then conflict_rejected:=true;end;
  if not conflict_rejected then raise exception 'Stale write accepted';end if;
  stage:='complete';completed:=true;
  raise sqlstate 'ZP001' using message='Rollback regression fixtures';
 exception
  when sqlstate 'ZP001' then null;
  when others then get stacked diagnostics error_code=returned_sqlstate;
   return jsonb_build_object('success',false,'stage',stage,'code',error_code,'fixturesRolledBack',true);
 end;
 if not completed or exists(select 1 from migration_stock.orders where id=fixture) then raise exception 'Probe did not roll back';end if;
 return jsonb_build_object('success',true,'checks',jsonb_build_array('create','purchase','receipt','cache invalidation','stale revision'),'fixturesRolledBack',true);
end $$;
revoke all on function public.stock_verify_save_probe() from public,anon,authenticated;
grant execute on function public.stock_verify_save_probe() to service_role;
notify pgrst,'reload schema';
