-- PT409 is an application conflict, not a transaction serialization failure.
-- PostgREST 14 can retry a manually raised 40001 indefinitely.
begin;
do $migration$
declare f record; definition text;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where p.prokind='f' and (n.nspname='migration_stock' or (n.nspname='public' and p.proname like 'stock_%')) loop
  definition:=pg_get_functiondef(f.oid);
  if strpos(definition,quote_literal('40001'))>0 then
   execute replace(definition,quote_literal('40001'),quote_literal('PT409'));
  end if;
 end loop;
end $migration$;
alter table migration_stock.notification_states add column if not exists summary jsonb;
update migration_stock.notification_states set summary=(state-'baseline')||'{"baseline":{}}'::jsonb where summary is null;

create or replace function public.stock_order_changes(payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare v bigint; version text; items jsonb;
begin
 select revision into v from migration_stock.read_epoch where id=1 for share;
 version:='epoch:'||v::text;
 if version=payload->>'version' then return jsonb_build_object('version',version,'items',null); end if;
 select c.items into items from migration_stock.read_cache c where cache_key='notification-changes' and revision=v;
 if items is null then
  perform pg_advisory_xact_lock(21873,hashtext('notification-changes'));
  select c.items into items from migration_stock.read_cache c where cache_key='notification-changes' and revision=v;
  if items is null then
   select coalesce(jsonb_agg(jsonb_build_object('Row_UID',id,'Revision',revision,'Group_ID',data->>'Group_ID','Group_Name',data->>'Group_Name','ChangeSignature',md5(data::text)) order by row_number),'[]') into items from migration_stock.order_rows where deleted_at is null and archived_at is null;
   insert into migration_stock.read_cache values('notification-changes',v,items) on conflict(cache_key) do update set revision=excluded.revision,items=excluded.items;
  end if;
 end if;
 return jsonb_build_object('version',version,'items',items);
end $$;

create or replace function public.stock_notifications(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u text:=payload->>'username'; current_version text; saved_version text; r bigint; small_state jsonb; full_state jsonb; changes jsonb;
begin
 if u is null or length(u)>120 or length(u)<1 then raise exception 'Invalid username' using errcode='22023';end if;
 select 'epoch:'||revision::text into current_version from migration_stock.read_epoch where id=1 for share;
 if payload->>'op'='read' then
  -- An unchanged poll reads only the compact summary: no baseline, insert, or row lock.
  select revision,order_version,summary into r,saved_version,small_state from migration_stock.notification_states where username=u;
  if not found then
   insert into migration_stock.notification_states(username,summary) values(u,'{"version":2,"initialized":false,"observedAt":0,"baseline":{},"notices":[]}') on conflict do nothing;
   select revision,order_version,summary into r,saved_version,small_state from migration_stock.notification_states where username=u;
  end if;
  if saved_version=current_version and not coalesce((payload->>'includeBaseline')::boolean,false) then
   return jsonb_build_object('state',small_state,'revision',r,'changes',jsonb_build_object('version',current_version,'items',null),'observedAt',floor(extract(epoch from clock_timestamp())*1000));
  end if;
  -- Read metadata and baseline from the same row version for optimistic concurrency.
  select revision,order_version,state into r,saved_version,full_state from migration_stock.notification_states where username=u;
  changes:=public.stock_order_changes(jsonb_build_object('version',saved_version));
  return jsonb_build_object('state',full_state,'revision',r,'changes',changes,'observedAt',floor(extract(epoch from clock_timestamp())*1000));
 end if;
 if payload->>'op'='save' then
  if current_version is distinct from payload->>'orderVersion' then raise sqlstate 'PT409' using message='Notification state changed';end if;
  update migration_stock.notification_states set state=payload->'state',summary=((payload->'state')-'baseline')||'{"baseline":{}}'::jsonb,order_version=current_version,revision=revision+1
   where username=u and revision=(payload->>'revision')::bigint;
  if not found then raise sqlstate 'PT409' using message='Notification state changed';end if;
  return jsonb_build_object('success',true);
 end if;
 raise exception 'Invalid notification operation' using errcode='22023';
end $$;
revoke all on function public.stock_notifications(jsonb),public.stock_order_changes(jsonb) from public,anon,authenticated;
grant execute on function public.stock_notifications(jsonb),public.stock_order_changes(jsonb) to service_role;
notify pgrst,'reload schema';
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
 exception when sqlstate 'PT409' then failed:=true;end;
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
 exception when sqlstate 'PT409' then failed:=true;end;
 if not failed then raise exception 'Stale client overwrote read state';end if;
 perform public.stock_notifications(jsonb_build_object('op','save','username','__release_notification_test__','revision',read_a->'revision','orderVersion',version,'state',state||'{"notices":[]}'::jsonb));
 read_b:=public.stock_notifications('{"op":"read","username":"__release_notification_test__"}');
 if jsonb_array_length(read_b->'state'->'notices')<>0 then raise exception 'Read state not shared';end if;
 if has_function_privilege('anon','public.stock_notifications(jsonb)','execute') or has_function_privilege('authenticated','public.stock_notifications(jsonb)','execute') then raise exception 'Public notification access';end if;
end $$;

do $$
declare a jsonb; b jsonb; v text; s jsonb; r bigint; failed boolean:=false;
begin
 a:=public.stock_notifications('{"op":"read","username":"__notification_cpu_test__"}');
 v:=a->'changes'->>'version';r:=(a->>'revision')::bigint;
 s:='{"version":2,"initialized":true,"observedAt":1,"notices":[]}'::jsonb||jsonb_build_object('baseline',jsonb_build_object('sentinel',jsonb_build_object('signature','keep','batchId','test')));
 perform public.stock_notifications(jsonb_build_object('op','save','username','__notification_cpu_test__','revision',r,'orderVersion',v,'state',s));
 a:=public.stock_notifications('{"op":"read","username":"__notification_cpu_test__"}');
 if a->'state'->'baseline'<>'{}'::jsonb or a->'changes'->'items'<>'null'::jsonb then raise exception 'Unchanged poll loads baseline';end if;
 b:=public.stock_notifications('{"op":"read","username":"__notification_cpu_test__","includeBaseline":true}');
 if b->'state'->'baseline'<>s->'baseline' then raise exception 'Acknowledgement baseline missing';end if;
 begin
  perform public.stock_notifications(jsonb_build_object('op','save','username','__notification_cpu_test__','revision',r,'orderVersion',v,'state',s));
 exception when sqlstate 'PT409' then failed:=true;end;
 if not failed then raise exception 'Conflict did not return PT409';end if;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.prokind='f' and(n.nspname='migration_stock' or(n.nspname='public' and p.proname like 'stock_%')) and strpos(pg_get_functiondef(p.oid),quote_literal('40001'))>0) then raise exception 'Legacy conflict code remains';end if;
end $$;
rollback;
select 'PASS: compact unchanged reads, full acknowledgement baseline, PT409 conflicts, atomic receipt rollback, shared read state, private access; all test writes rolled back' result;
