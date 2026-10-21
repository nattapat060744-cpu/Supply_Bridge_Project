begin;
do $$
declare a uuid; b uuid; first_id uuid; second_id uuid; r integer; failed boolean:=false; d jsonb;
begin
 a:=migration_stock.order_write(null,'{"Group_ID":"atomic-test","Product_ID":"a","Status":"PENDING","Note_Request":"keep request","Note_Stock":"keep stock"}',null);
 b:=migration_stock.order_write(null,'{"Group_ID":"atomic-test","Product_ID":"b","Status":"PENDING"}',null);
 first_id:=least(a,b); second_id:=greatest(a,b);
 select revision into r from migration_stock.orders where id=first_id;
 begin
  perform public.stock_save_orders(jsonb_build_object('items',jsonb_build_array(
   jsonb_build_object('id',first_id,'revision',r,'data',jsonb_build_object('Status','ORDERED')),
   jsonb_build_object('id',second_id,'revision',-1,'data',jsonb_build_object('Status','ORDERED')))));
 exception when serialization_failure then failed:=true;
 end;
 if not failed then raise exception 'Stale batch accepted'; end if;
 if (select status from migration_stock.orders where id=first_id)<>'PENDING' then raise exception 'Partial batch persisted';end if;
 perform public.stock_save_orders(jsonb_build_object('items',jsonb_build_array(jsonb_build_object('id',a,'revision',(select revision from migration_stock.orders where id=a),'data',jsonb_build_object('Status','ORDERED')))));
 select data into d from migration_stock.order_rows where id=a;
 if d->>'Status'<>'ORDERED' or d->>'Note_Request'<>'keep request' or d->>'Note_Stock'<>'keep stock' then raise exception 'Notes lost';end if;
 if has_function_privilege('anon','public.stock_save_orders(jsonb)','execute') or has_function_privilege('authenticated','public.stock_save_orders(jsonb)','execute') then raise exception 'Public batch access';end if;
end $$;
rollback;
select 'atomic batch rollback, revision conflict, preserved notes and access checks passed; no records retained' as result;
