begin;
do $$
declare result jsonb; duplicates_blocked boolean:=false; admin_blocked boolean:=false; profile uuid;
begin
 result:=public.stock_register(jsonb_build_object('username','integration-signup-check','name','Signup check','department','SORTING','passwordHash','pbkdf2$210000$test$test','createdAt','21/10/2569 12:00:00'));
 select id into profile from migration_stock.user_profiles where username='integration-signup-check';
 if profile is null or not exists(select 1 from migration_stock.app_credentials where profile_id=profile) then raise exception 'Not immediately active'; end if;
 if exists(select 1 from migration_stock.user_requests where username='integration-signup-check' and status='PENDING') then raise exception 'Still pending'; end if;
 if result->>'department'<>'SORTING' then raise exception 'Wrong department'; end if;
 begin
  perform public.stock_register(jsonb_build_object('username','INTEGRATION-SIGNUP-CHECK','name','Duplicate','department','STOCK','passwordHash','pbkdf2$210000$test$test','createdAt','21/10/2569 12:00:00'));
 exception when unique_violation then duplicates_blocked:=true;end;
 begin
  perform public.stock_register(jsonb_build_object('username','integration-signup-admin','name','No admin signup','department','ADMIN','passwordHash','pbkdf2$210000$test$test','createdAt','21/10/2569 12:00:00'));
 exception when invalid_parameter_value then admin_blocked:=true;end;
 if not duplicates_blocked or not admin_blocked then raise exception 'Validation failed'; end if;
end $$;
rollback;
select 'instant registration, credential creation, duplicates and role checks passed; test data rolled back' as result;
