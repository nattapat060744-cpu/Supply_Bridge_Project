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
commit;
