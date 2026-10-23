-- Keep ordered purchases only through midnight in Asia/Bangkok.
begin;
do $migration$
declare definition text;
begin
 select pg_get_functiondef('public.stock_work_page(jsonb)'::regprocedure) into definition;
 if strpos(definition, $$coalesce(o.created_at_p,o.created_at)>=now_local-interval '24 hours'$$)=0 then raise exception 'Expected purchase visibility predicate not found';end if;
 definition:=replace(definition,$$coalesce(o.created_at_p,o.created_at)>=now_local-interval '24 hours'$$,$$coalesce(o.created_at_p,o.created_at)>=date_trunc('day',now_local) and coalesce(o.created_at_p,o.created_at)<date_trunc('day',now_local)+interval '1 day'$$);
 definition:=replace(definition,$$floor(extract(epoch from clock_timestamp())/60)::text$$,$$'midnight-v1:'||to_char(now_local,'YYYY-MM-DD')$$);
 execute definition;
end $migration$;
do $check$
declare current_day timestamp:=date_trunc('day',clock_timestamp() at time zone 'Asia/Bangkok'); actual jsonb; expected integer;
begin
 if not(timestamp '2026-10-23 15:00'>=timestamp '2026-10-23 00:00' and timestamp '2026-10-23 15:00'<timestamp '2026-10-24 00:00') then raise exception 'Same-day boundary failed';end if;
 if timestamp '2026-10-23 15:00'>=timestamp '2026-10-24 00:00' then raise exception 'Previous-day boundary failed';end if;
 select count(distinct coalesce(nullif(g.legacy_group_id,''),'ทั่วไป')) into expected
 from migration_stock.orders o left join migration_stock.order_groups g on g.id=o.group_id
 where o.deleted_at is null and o.archived_at is null and(o.status='PENDING' or(o.status='ORDERED' and coalesce(o.created_at_p,o.created_at)>=current_day and coalesce(o.created_at_p,o.created_at)<current_day+interval '1 day'));
 actual:=public.stock_work_page('{"kind":"purchase","page":1}'::jsonb);
 if (actual->>'total')::integer<>expected then raise exception 'Purchase total mismatch';end if;
 if actual->>'version' not like '%:midnight-v1:'||to_char(current_day,'YYYY-MM-DD') then raise exception 'Version must change at Bangkok midnight';end if;
 if not(public.stock_work_page(jsonb_build_object('kind','purchase','version',actual->>'version'))->>'unchanged')::boolean then raise exception 'Unchanged version check failed';end if;
end $check$;
notify pgrst,'reload schema';
commit;
