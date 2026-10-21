-- Exercises real database writes, then rolls all changes back.
begin;
do $$
declare i uuid; r integer; d jsonb; failed boolean:=false; before_count bigint;
begin
 if migration_stock.parse_legacy_date('21/10/2569')<>timestamp '2026-10-21 00:00:00' then raise exception 'Date-only conversion failed'; end if;
 if has_function_privilege('anon','public.stock_bridge(text,jsonb)','execute') or has_function_privilege('authenticated','public.stock_bridge(text,jsonb)','execute') then raise exception 'Browser roles may call privileged bridge'; end if;
 select count(*) into before_count from migration_stock.orders;
 i:=migration_stock.order_write(null,jsonb_build_object('Group_ID','integration-transaction','Product_ID','integration-product','Product_Name','Integration check','Supplier','Integration supplier','Status','PENDING','Created_At','21/10/2569 12:00:00','Order_Carton',2,'Qty_Per_Carton',24));
 select revision into r from migration_stock.orders where id=i;
 perform migration_stock.order_write(i,'{"Status":"ORDERED","Note_Purchase":"verified"}',r);
 begin
  perform migration_stock.order_write(i,'{"Status":"REJECTED"}',r);
 exception when serialization_failure then failed:=true; end;
 if not failed then raise exception 'Stale write was accepted'; end if;
 select revision into r from migration_stock.orders where id=i;
 perform migration_stock.order_write(i,'{"Status":"COMPLETED","Recv_Carton":2,"Recv_Qty":24,"Receiver_Name":"Integration check","Recv_Date":"21/10/2569 12:01:00"}',r);
 select data into d from migration_stock.order_rows where id=i;
 if d->>'Status'<>'COMPLETED' or (d->>'Recv_Qty')::numeric<>24 or d->>'Note_Purchase'<>'verified' then raise exception 'Round trip failed'; end if;
 if (select created_at from migration_stock.orders where id=i)<>timestamp '2026-10-21 12:00:00' then raise exception 'Buddhist date conversion failed'; end if;
 select revision into r from migration_stock.orders where id=i;
 perform public.stock_bridge('delete',jsonb_build_object('table','Orders','id',i,'revision',r));
 if (select deleted_at is null from migration_stock.orders where id=i) then raise exception 'Soft delete failed'; end if;
 if (select count(*) from migration_stock.orders)<>before_count+1 then raise exception 'Unexpected count'; end if;
end $$;
rollback;
select 'transaction tests passed; all test records rolled back' as result;
