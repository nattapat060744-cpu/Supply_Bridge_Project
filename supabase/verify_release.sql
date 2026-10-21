begin;
do $$
declare a uuid; b uuid; first_id uuid; second_id uuid; failed boolean:=false; state jsonb; read_a jsonb; read_b jsonb; version text; r bigint;
begin
 a:=migration_stock.order_write(null,'{"Group_ID":"release-test","Product_ID":"release-a","Status":"ORDERED","Order_Carton":2,"Qty_Per_Carton":24}',null);
 b:=migration_stock.order_write(null,'{"Group_ID":"release-test","Product_ID":"release-b","Status":"ORDERED","Order_Carton":3,"Qty_Per_Carton":12}',null);
 first_id:=least(a,b);second_id:=greatest(a,b);
 begin
  perform public.stock_save_orders(jsonb_build_object('items',jsonb_build_array(
   jsonb_build_object('id',first_id,'revision',(select revision from migration_stock.orders where id=first_id),'data','{"Status":"COMPLETED","Recv_Carton":2,"Recv_Qty":24,"Receiver_Name":"Release test"}'::jsonb),
   jsonb_build_object('id',second_id,'revision',-1,'data','{"Status":"COMPLETED","Recv_Carton":3,"Recv_Qty":12}'::jsonb))));
 exception when serialization_failure then failed:=true;end;
 if not failed or (select status from migration_stock.orders where id=first_id)<>'ORDERED' or exists(select 1 from migration_stock.receipt_snapshots where order_id in(a,b)) then raise exception 'Partial receipt batch persisted';end if;
 perform public.stock_save_orders(jsonb_build_object('items',jsonb_build_array(
  jsonb_build_object('id',a,'revision',(select revision from migration_stock.orders where id=a),'data','{"Status":"COMPLETED","Recv_Carton":2,"Recv_Qty":24,"Receiver_Name":"Release test"}'::jsonb),
  jsonb_build_object('id',b,'revision',(select revision from migration_stock.orders where id=b),'data','{"Status":"COMPLETED","Recv_Carton":3,"Recv_Qty":12,"Receiver_Name":"Release test"}'::jsonb))));
 if (select count(*) from migration_stock.receipt_snapshots where order_id in(a,b))<>2 then raise exception 'Receipt batch missing';end if;
 read_a:=public.stock_notifications('{"op":"read","username":"__release_notification_test__"}');
 version:=read_a->'changes'->>'version';r:=(read_a->>'revision')::bigint;
 state:='{"version":2,"initialized":true,"observedAt":1,"baseline":{},"notices":[{"id":"release-test","batchId":"release-test","changedKeys":[],"updatedAt":1}]}'::jsonb;
 perform public.stock_notifications(jsonb_build_object('op','save','username','__release_notification_test__','revision',r,'orderVersion',version,'state',state));
 read_a:=public.stock_notifications('{"op":"read","username":"__release_notification_test__"}');
 read_b:=public.stock_notifications('{"op":"read","username":"__release_notification_test__"}');
 if read_a->'state'<>read_b->'state' then raise exception 'Two clients disagree';end if;
 failed:=false;
 begin
  perform public.stock_notifications(jsonb_build_object('op','save','username','__release_notification_test__','revision',r,'orderVersion',version,'state',state));
 exception when serialization_failure then failed:=true;end;
 if not failed then raise exception 'Stale client overwrote read state';end if;
 perform public.stock_notifications(jsonb_build_object('op','save','username','__release_notification_test__','revision',read_a->'revision','orderVersion',version,'state',state||'{"notices":[]}'::jsonb));
 read_b:=public.stock_notifications('{"op":"read","username":"__release_notification_test__"}');
 if jsonb_array_length(read_b->'state'->'notices')<>0 then raise exception 'Read state not shared';end if;
 if has_function_privilege('anon','public.stock_notifications(jsonb)','execute') or has_function_privilege('authenticated','public.stock_notifications(jsonb)','execute') then raise exception 'Public notification access';end if;
end $$;
rollback;
select 'PASS: atomic receipt rollback/success, two-client shared reads, stale-client conflict, private access; all fixtures rolled back' as result;
