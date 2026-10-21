begin;
create or replace function public.stock_register(payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare u migration_stock.user_profiles; signup_username text:=btrim(payload->>'username'); department text:=payload->>'department'; stamp text:=payload->>'createdAt';
begin
 if signup_username is null or length(signup_username)<3 or length(signup_username)>120 or nullif(btrim(payload->>'name'),'') is null or department is null or department not in ('SORTING','PURCHASE','STOCK','SORTING_VIEWER','STOCK_SORTING_MANAGER') or coalesce(payload->>'passwordHash','') not like 'pbkdf2$210000$%' then raise exception 'Invalid registration' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtext(lower(signup_username)));
 if exists(select 1 from migration_stock.user_profiles p where lower(p.username)=lower(signup_username)) then raise exception 'Username already exists' using errcode='23505'; end if;
 insert into migration_stock.user_profiles(id,username,display_name,department) values(gen_random_uuid(),signup_username,btrim(payload->>'name'),department) returning * into u;
 insert into migration_stock.app_credentials(profile_id,password_hash) values(u.id,payload->>'passwordHash');
 -- Keep an audit entry; signup is active immediately and never waits for review.
 update migration_stock.user_requests set status='REPLACED',revision=revision+1 where lower(migration_stock.user_requests.username)=lower(u.username) and status='PENDING';
 insert into migration_stock.user_requests(id,legacy_request_id,username,display_name,department,status,created_at_raw,created_at,reviewed_by,reviewed_at_raw,reviewed_at)
 values(gen_random_uuid(),gen_random_uuid()::text,u.username,u.display_name,u.department,'APPROVED',stamp,migration_stock.parse_legacy_date(stamp),'SELF_REGISTERED',stamp,migration_stock.parse_legacy_date(stamp));
 return jsonb_build_object('username',u.username,'name',u.display_name,'department',u.department);
end $$;
revoke all on function public.stock_register(jsonb) from public,anon,authenticated;
grant execute on function public.stock_register(jsonb) to service_role;
notify pgrst,'reload schema';
commit;

