-- Shared read cache: invalidated transactionally on every source-table write.
-- Read locks prevent an old snapshot being published after invalidation.
begin;
create table if not exists migration_stock.read_epoch(id integer primary key check(id=1),revision bigint not null);
insert into migration_stock.read_epoch values(1,1) on conflict do nothing;
create table if not exists migration_stock.read_cache(cache_key text primary key,revision bigint not null,items jsonb not null);
alter table migration_stock.read_epoch enable row level security;
alter table migration_stock.read_cache enable row level security;
revoke all on migration_stock.read_epoch,migration_stock.read_cache from public,anon,authenticated;
create or replace function migration_stock.invalidate_read_cache() returns trigger language plpgsql security definer set search_path='' as $$
begin
 update migration_stock.read_epoch set revision=revision+1 where id=1;
 delete from migration_stock.read_cache;
 return null;
end $$;
drop trigger if exists invalidate_read_cache on migration_stock.orders;
create trigger invalidate_read_cache after insert or update or delete or truncate on migration_stock.orders for each statement execute function migration_stock.invalidate_read_cache();
drop trigger if exists invalidate_read_cache on migration_stock.products;
create trigger invalidate_read_cache after insert or update or delete or truncate on migration_stock.products for each statement execute function migration_stock.invalidate_read_cache();
drop trigger if exists invalidate_read_cache on migration_stock.suppliers;
create trigger invalidate_read_cache after insert or update or delete or truncate on migration_stock.suppliers for each statement execute function migration_stock.invalidate_read_cache();
drop trigger if exists invalidate_read_cache on migration_stock.order_groups;
create trigger invalidate_read_cache after insert or update or delete or truncate on migration_stock.order_groups for each statement execute function migration_stock.invalidate_read_cache();
drop trigger if exists invalidate_read_cache on migration_stock.receipt_snapshots;
create trigger invalidate_read_cache after insert or update or delete or truncate on migration_stock.receipt_snapshots for each statement execute function migration_stock.invalidate_read_cache();
create or replace function migration_stock.build_stock_orders(payload jsonb default '{}') returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'rowNumber',row_number,'revision',revision,'signature',md5(data::text),'data',data) order by row_number),'[]') from migration_stock.order_rows where deleted_at is null and(case when coalesce(payload->>'table','Orders')='Orders' then archived_at is null else archive_name=payload->>'table' end);
$$;

create or replace function public.stock_orders(payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare v bigint; result jsonb; k text:='orders:'||coalesce(payload->>'table','Orders');
begin
 select revision into v from migration_stock.read_epoch where id=1 for share;
 select items into result from migration_stock.read_cache where cache_key=k and revision=v;
 if result is not null then return result; end if;
 -- Merge cache misses across Vercel instances, without blocking cache hits.
 perform pg_advisory_xact_lock(21873,hashtext(k));
 select items into result from migration_stock.read_cache where cache_key=k and revision=v;
 if result is null then
  result:=migration_stock.build_stock_orders(payload);
  insert into migration_stock.read_cache values(k,v,result) on conflict(cache_key) do update set revision=excluded.revision,items=excluded.items;
 end if;
 return result;
end $$;
create or replace function public.stock_order_changes(payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare version text; items jsonb;
begin
 select 'epoch:'||revision::text into version from migration_stock.read_epoch where id=1 for share;
 if version=payload->>'version' then return jsonb_build_object('version',version,'items',null); end if;
 select coalesce(jsonb_agg(jsonb_build_object('Row_UID',id,'Revision',revision,'Group_ID',data->>'Group_ID','Group_Name',data->>'Group_Name','ChangeSignature',md5(data::text)) order by row_number),'[]') into items from migration_stock.order_rows where deleted_at is null and archived_at is null;
 return jsonb_build_object('version',version,'items',items);
end $$;
create or replace function public.stock_notifications(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u text:=payload->>'username'; n migration_stock.notification_states; changes jsonb; current_version text;
begin
 if u is null or length(u)>120 or length(u)<1 then raise exception 'Invalid username' using errcode='22023';end if;
 insert into migration_stock.notification_states(username) values(u) on conflict do nothing;
 select * into n from migration_stock.notification_states where username=u for update;
 if payload->>'op'='read' then
  changes:=public.stock_order_changes(jsonb_build_object('version',n.order_version));
  return jsonb_build_object('state',case when changes->'items'='null'::jsonb and not coalesce((payload->>'includeBaseline')::boolean,false) then (n.state-'baseline')||'{"baseline":{}}'::jsonb else n.state end,'revision',n.revision,'changes',changes,'observedAt',floor(extract(epoch from clock_timestamp())*1000));
 end if;
 if payload->>'op'='save' then
  select 'epoch:'||revision::text into current_version from migration_stock.read_epoch where id=1 for share;
  if n.revision<>(payload->>'revision')::bigint or current_version<>payload->>'orderVersion' then raise exception 'Notification state changed' using errcode='40001';end if;
  update migration_stock.notification_states set state=payload->'state',order_version=current_version,revision=revision+1 where username=u;
  return jsonb_build_object('success',true);
 end if;
 raise exception 'Invalid notification operation' using errcode='22023';
end $$;
create or replace function public.stock_sorting_page(payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare page_size integer:=least(greatest(coalesce((payload->>'pageSize')::integer,6),1),20); page_number integer:=greatest(coalesce((payload->>'page')::integer,1),1); total integer; ids text[]; result jsonb;
begin
 if coalesce(payload->>'productId','')<>'' then
  select coalesce(jsonb_agg(x.item),'[]') into result from (
   select jsonb_build_object('id',r.id,'rowNumber',r.row_number,'revision',r.revision,'signature',md5(r.data::text),'data',r.data) item
   from migration_stock.order_rows r where r.deleted_at is null and r.archived_at is null and r.data->>'Product_ID'=payload->>'productId' and r.data->>'Status' not in('COMPLETED','REJECTED') and coalesce(r.data->>'Recv_Date','')='' order by r.row_number desc limit 1
  ) x;
  return jsonb_build_object('items',result);
 end if;
 with groups as (
  select coalesce(g.legacy_group_id,'no-batch') id,max(o.created_at) created_at,max(o.source_row) source_row,
   bool_or(coalesce(payload->>'q','')='' or strpos(lower(concat_ws(' ',g.legacy_group_id,o.extra->>'Group_Name',p.legacy_product_id,o.product_name_snapshot,s.legacy_name)),lower(payload->>'q'))>0) matches
  from migration_stock.orders o left join migration_stock.order_groups g on g.id=o.group_id left join migration_stock.products p on p.id=o.product_id left join migration_stock.suppliers s on s.id=o.supplier_id
  where o.deleted_at is null and o.archived_at is null group by coalesce(g.legacy_group_id,'no-batch')
 ), numbered as (select id,row_number() over(order by created_at desc nulls last,source_row desc,id) n from groups where matches)
 select count(*),case when coalesce(payload->>'locateBatch','')<>'' then coalesce(max(ceil(n::numeric/page_size)) filter(where id=payload->>'locateBatch'),1)::integer else page_number end into total,page_number from numbered;
 page_number:=least(page_number,greatest(ceil(total::numeric/page_size)::integer,1));
 with groups as (
  select coalesce(g.legacy_group_id,'no-batch') id,max(o.created_at) created_at,max(o.source_row) source_row,
   bool_or(coalesce(payload->>'q','')='' or strpos(lower(concat_ws(' ',g.legacy_group_id,o.extra->>'Group_Name',p.legacy_product_id,o.product_name_snapshot,s.legacy_name)),lower(payload->>'q'))>0) matches
  from migration_stock.orders o left join migration_stock.order_groups g on g.id=o.group_id left join migration_stock.products p on p.id=o.product_id left join migration_stock.suppliers s on s.id=o.supplier_id
  where o.deleted_at is null and o.archived_at is null group by coalesce(g.legacy_group_id,'no-batch')
 ) select array_agg(id) into ids from(select id from groups where matches order by created_at desc nulls last,source_row desc,id limit page_size offset (page_number-1)*page_size) chosen;
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'rowNumber',r.row_number,'revision',r.revision,'signature',md5(r.data::text),'data',r.data) order by array_position(ids,coalesce(g.legacy_group_id,'no-batch')),r.row_number),'[]') into result from migration_stock.orders o left join migration_stock.order_groups g on g.id=o.group_id join migration_stock.order_rows r on r.id=o.id where o.deleted_at is null and o.archived_at is null and coalesce(g.legacy_group_id,'no-batch')=any(ids);
 return jsonb_build_object('items',result,'page',page_number,'pageSize',page_size,'total',total,'totalPages',greatest(ceil(total::numeric/page_size)::integer,1),'batchIds',coalesce(to_jsonb(ids),'[]'));
end $$;

revoke all on function migration_stock.build_stock_orders(jsonb),migration_stock.invalidate_read_cache() from public,anon,authenticated;
revoke all on function public.stock_orders(jsonb),public.stock_order_changes(jsonb),public.stock_notifications(jsonb),public.stock_sorting_page(jsonb) from public,anon,authenticated;
grant execute on function public.stock_orders(jsonb),public.stock_order_changes(jsonb),public.stock_notifications(jsonb),public.stock_sorting_page(jsonb) to service_role;
notify pgrst,'reload schema';
commit;
