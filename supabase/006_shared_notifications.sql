begin;
create table if not exists migration_stock.notification_states (
 username text primary key,
 revision bigint not null default 0,
 order_version text not null default '',
 state jsonb not null default '{"version":2,"initialized":false,"observedAt":0,"baseline":{},"notices":[]}'
);
alter table migration_stock.notification_states enable row level security;
revoke all on migration_stock.notification_states from public,anon,authenticated;
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
  select md5(coalesce(string_agg(o.id::text||':'||o.revision::text,',' order by o.id),'')) into current_version from migration_stock.orders o where deleted_at is null and archived_at is null;
  if n.revision<>(payload->>'revision')::bigint or current_version<>payload->>'orderVersion' then raise exception 'Notification state changed' using errcode='40001';end if;
  update migration_stock.notification_states set state=payload->'state',order_version=current_version,revision=revision+1 where username=u;
  return jsonb_build_object('success',true);
 end if;
 raise exception 'Invalid notification operation' using errcode='22023';
end $$;
revoke all on function public.stock_notifications(jsonb) from public,anon,authenticated;
grant execute on function public.stock_notifications(jsonb) to service_role;
notify pgrst,'reload schema';
commit;
