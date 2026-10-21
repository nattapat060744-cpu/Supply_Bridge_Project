begin;
alter table migration_stock.orders add column if not exists extra jsonb not null default '{}', add column if not exists revision integer not null default 0, add column if not exists deleted_at timestamptz, add column if not exists archived_at timestamptz, add column if not exists archived_by text, add column if not exists archive_name text;
create sequence migration_stock.order_row_number;
select setval('migration_stock.order_row_number', coalesce((select max(source_row) from migration_stock.orders),1));
alter table migration_stock.orders alter column source_row set default nextval('migration_stock.order_row_number');
alter table migration_stock.user_profiles add column if not exists revision integer not null default 0;
create sequence migration_stock.user_row_number;
select setval('migration_stock.user_row_number',coalesce((select max(source_row) from migration_stock.user_profiles),1));
alter table migration_stock.user_profiles alter column source_row set default nextval('migration_stock.user_row_number');
alter table migration_stock.user_requests add column if not exists extra jsonb not null default '{}', add column if not exists revision integer not null default 0;
create sequence migration_stock.request_row_number;
select setval('migration_stock.request_row_number',coalesce((select max(source_row) from migration_stock.user_requests),1));
alter table migration_stock.user_requests alter column source_row set default nextval('migration_stock.request_row_number');
create index profiles_username_lookup on migration_stock.user_profiles (lower(username));
create unique index requests_pending_username_unique on migration_stock.user_requests (lower(username)) where status='PENDING';
create table migration_stock.app_credentials (profile_id uuid primary key references migration_stock.user_profiles(id), password_hash text not null);
alter table migration_stock.app_credentials enable row level security;
create table migration_stock.request_credentials (request_id uuid primary key references migration_stock.user_requests(id), password_hash text not null);
alter table migration_stock.request_credentials enable row level security;
create table migration_stock.password_requests (id uuid primary key default gen_random_uuid(), source_row bigint generated always as identity, revision integer not null default 0, data jsonb not null);
alter table migration_stock.password_requests enable row level security;
create unique index password_requests_pending_username_unique on migration_stock.password_requests(lower(data->>'Username')) where data->>'Status'='PENDING';

create view migration_stock.order_rows with (security_invoker=true) as
select o.id, o.source_row as row_number, o.revision,
o.extra || jsonb_build_object('Row_UID',o.id,'Group_ID',g.legacy_group_id,'Status',o.status,'Product_ID',p.legacy_product_id,'Product_Name',o.product_name_snapshot,'Supplier',s.legacy_name,'Shop_Qty',o.shop_qty,'Stock_Qty',o.stock_qty,'Note_Request',o.note_request,'Order_Carton',o.order_carton,'Carton_Unit',o.carton_unit,'Qty_Per_Carton',o.qty_per_carton,'Inner_Unit',o.inner_unit,'Note_Purchase',o.note_purchase,'Invoice_No',o.invoice_no,'Created_At',o.created_at_raw,'Created_At_P',o.created_at_p_raw,'Receiver_Name',r.receiver_name,'Recv_Carton',r.recv_carton,'Recv_Unit',r.recv_unit,'Recv_Qty',r.recv_qty,'Recv_Qty_Unit',r.recv_qty_unit,'Note_Stock',r.note_stock,'Recv_Date',r.recv_date_raw) as data,
o.deleted_at,o.archived_at,o.archive_name
from migration_stock.orders o left join migration_stock.products p on p.id=o.product_id left join migration_stock.suppliers s on s.id=o.supplier_id left join migration_stock.order_groups g on g.id=o.group_id left join migration_stock.receipt_snapshots r on r.order_id=o.id;

create function migration_stock.parse_legacy_date(v text) returns timestamp language plpgsql immutable set search_path='' as $$
declare parts text[]; y integer;
begin
 if v is null or btrim(v)='' then return null; end if;
 if v ~ '^\d{4}-' then
  y:=substring(v,1,4)::integer;
  return ((case when y>=2400 then (y-543)::text||substring(v,5) else v end))::timestamp;
 end if;
 parts:=regexp_match(v,'^(\d{1,2})/(\d{1,2})/(\d{4})(?:[, ]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$');
 if parts is not null then
  y:=parts[3]::integer; if y>=2400 then y:=y-543; end if;
  return make_timestamp(y,parts[2]::integer,parts[1]::integer,coalesce(parts[4],'0')::integer,coalesce(parts[5],'0')::integer,coalesce(parts[6],'0')::double precision);
 end if;
 raise exception 'Unsupported date format' using errcode='22007';
end $$;

create function migration_stock.order_write(item_id uuid, changes jsonb, expected_revision integer default null) returns uuid language plpgsql set search_path='' as $$
declare o migration_stock.orders; r migration_stock.receipt_snapshots; data jsonb; patch jsonb:='{}'; k text; v text; mapping jsonb; new_id uuid; entity_id uuid;
begin
 if item_id is not null then
  select * into o from migration_stock.orders where id=item_id and deleted_at is null for update;
  if not found then raise exception 'Order not found' using errcode='P0002'; end if;
  if expected_revision is distinct from o.revision then raise exception 'Order changed; refresh and retry' using errcode='40001'; end if;
  new_id:=item_id;
 else
  new_id:=coalesce(nullif(changes->>'Row_UID','')::uuid,gen_random_uuid());
  insert into migration_stock.orders(id,status) values(new_id,'PENDING') returning * into o;
 end if;
 mapping:='{"Status":"status","Product_Name":"product_name_snapshot","Shop_Qty":"shop_qty","Stock_Qty":"stock_qty","Note_Request":"note_request","Order_Carton":"order_carton","Carton_Unit":"carton_unit","Qty_Per_Carton":"qty_per_carton","Inner_Unit":"inner_unit","Note_Purchase":"note_purchase","Invoice_No":"invoice_no","Created_At":"created_at_raw","Created_At_P":"created_at_p_raw"}';
 for k,v in select key,value from jsonb_each_text(mapping) loop
  if changes ? k then patch:=patch||jsonb_build_object(v,case when v in ('shop_qty','stock_qty','order_carton','qty_per_carton') then nullif(changes->>k,'') else changes->>k end); end if;
 end loop;
 if changes ? 'Product_ID' then
  insert into migration_stock.products(id,legacy_product_id,name_variants) values(gen_random_uuid(),changes->>'Product_ID',case when changes->>'Product_Name' is null then '[]'::jsonb else jsonb_build_array(changes->>'Product_Name') end)
  on conflict(legacy_product_id) do update set name_variants=(select coalesce(jsonb_agg(distinct x),'[]') from jsonb_array_elements(migration_stock.products.name_variants||excluded.name_variants) as e(x)) returning id into entity_id;
  patch:=patch||jsonb_build_object('product_id',entity_id);
 end if;
 if changes ? 'Supplier' then
  insert into migration_stock.suppliers(id,legacy_name) values(gen_random_uuid(),coalesce(changes->>'Supplier','')) on conflict(legacy_name) do update set legacy_name=excluded.legacy_name returning id into entity_id;
  patch:=patch||jsonb_build_object('supplier_id',entity_id);
 end if;
 if changes ? 'Group_ID' then
  insert into migration_stock.order_groups(id,legacy_group_id) values(gen_random_uuid(),coalesce(changes->>'Group_ID','')) on conflict(legacy_group_id) do update set legacy_group_id=excluded.legacy_group_id returning id into entity_id;
  patch:=patch||jsonb_build_object('group_id',entity_id);
 end if;
 if changes ? 'Created_At' then patch:=patch||jsonb_build_object('created_at',migration_stock.parse_legacy_date(changes->>'Created_At')); end if;
 if changes ? 'Created_At_P' then patch:=patch||jsonb_build_object('created_at_p',migration_stock.parse_legacy_date(changes->>'Created_At_P')); end if;
 o:=jsonb_populate_record(o,patch);
 update migration_stock.orders set product_id=o.product_id,supplier_id=o.supplier_id,group_id=o.group_id,status=o.status,product_name_snapshot=o.product_name_snapshot,shop_qty=o.shop_qty,stock_qty=o.stock_qty,note_request=o.note_request,order_carton=o.order_carton,carton_unit=o.carton_unit,qty_per_carton=o.qty_per_carton,inner_unit=o.inner_unit,note_purchase=o.note_purchase,invoice_no=o.invoice_no,created_at_raw=o.created_at_raw,created_at=o.created_at,created_at_p_raw=o.created_at_p_raw,created_at_p=o.created_at_p,extra=extra||(changes-array(select jsonb_object_keys(mapping)))-array['Row_UID','Product_ID','Supplier','Group_ID','Receiver_Name','Recv_Carton','Recv_Unit','Recv_Qty','Recv_Qty_Unit','Note_Stock','Recv_Date'],revision=revision+1 where id=new_id;
 if changes ?| array['Receiver_Name','Recv_Carton','Recv_Unit','Recv_Qty','Recv_Qty_Unit','Note_Stock','Recv_Date'] then
  insert into migration_stock.receipt_snapshots(id,order_id) values(gen_random_uuid(),new_id) on conflict(order_id) do nothing;
  select * into r from migration_stock.receipt_snapshots where order_id=new_id;
  patch:='{}'; mapping:='{"Receiver_Name":"receiver_name","Recv_Carton":"recv_carton","Recv_Unit":"recv_unit","Recv_Qty":"recv_qty","Recv_Qty_Unit":"recv_qty_unit","Note_Stock":"note_stock","Recv_Date":"recv_date_raw"}';
  for k,v in select key,value from jsonb_each_text(mapping) loop
   if changes ? k then patch:=patch||jsonb_build_object(v,case when v in ('recv_carton','recv_qty') then nullif(changes->>k,'') else changes->>k end); end if;
  end loop;
  if changes ? 'Recv_Date' then patch:=patch||jsonb_build_object('recv_date',migration_stock.parse_legacy_date(changes->>'Recv_Date')); end if;
  r:=jsonb_populate_record(r,patch);
  update migration_stock.receipt_snapshots set receiver_name=r.receiver_name,recv_carton=r.recv_carton,recv_unit=r.recv_unit,recv_qty=r.recv_qty,recv_qty_unit=r.recv_qty_unit,note_stock=r.note_stock,recv_date_raw=r.recv_date_raw,recv_date=r.recv_date where order_id=new_id;
 end if;
 return new_id;
end $$;

create function public.stock_bridge(op text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare t text:=payload->>'table'; result jsonb; item jsonb; i uuid; existing_revision integer; off integer:=greatest(coalesce((payload->>'offset')::integer,0),0); lim integer:=least(greatest(coalesce((payload->>'limit')::integer,500),1),500); u migration_stock.user_profiles; q migration_stock.user_requests;
begin
 if op='tables' then
  select jsonb_build_array('Orders','Users','User_Requests','Password_Requests')||coalesce(jsonb_agg(distinct archive_name) filter(where archive_name is not null),'[]') into result from migration_stock.orders where deleted_at is null;
  return result;
 elsif op='list' then
  if t='Orders' or t like 'Orders_Archive_%' then
   select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'rowNumber',x.row_number,'revision',x.revision,'data',x.data) order by x.row_number),'[]') into result from (select * from migration_stock.order_rows where deleted_at is null and (case when t='Orders' then archived_at is null else archive_name=t end) order by row_number limit lim offset off) x;
  elsif t='Users' then
   select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'rowNumber',x.source_row,'revision',x.revision,'data',jsonb_build_object('Username',x.username,'Name',x.display_name,'Department',x.department,'Password',x.password_hash)) order by x.source_row),'[]') into result from (select p.*,c.password_hash from migration_stock.user_profiles p left join migration_stock.app_credentials c on c.profile_id=p.id order by p.source_row limit lim offset off) x;
  elsif t='User_Requests' then
   select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'rowNumber',x.source_row,'revision',x.revision,'data',x.extra||jsonb_build_object('Request_ID',coalesce(x.legacy_request_id,x.id::text),'Username',x.username,'Name',x.display_name,'Department',x.department,'Status',x.status,'Created_At',x.created_at_raw,'Reviewed_At',x.reviewed_at_raw,'Reviewed_By',x.reviewed_by)) order by x.source_row),'[]') into result from (select * from migration_stock.user_requests order by source_row limit lim offset off) x;
  elsif t='Password_Requests' then
   select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'rowNumber',x.source_row,'revision',x.revision,'data',x.data) order by x.source_row),'[]') into result from (select * from migration_stock.password_requests order by source_row limit lim offset off) x;
  else raise exception 'Unknown table'; end if;
  return result;
 elsif op='insert' then
  for item in select value from jsonb_array_elements(payload->'rows') loop
   if t='Orders' then perform migration_stock.order_write(null,item);
   elsif t='User_Requests' then
    insert into migration_stock.user_requests(id,legacy_request_id,username,display_name,department,status,created_at_raw,created_at,extra) values(gen_random_uuid(),item->>'Request_ID',item->>'Username',item->>'Name',item->>'Department','PENDING',item->>'Created_At',migration_stock.parse_legacy_date(item->>'Created_At'),item-array['Password','Password_Hash']) returning id into i;
    if item->>'Password_Hash' is not null then insert into migration_stock.request_credentials values(i,item->>'Password_Hash'); end if;
   elsif t='Password_Requests' then
    insert into migration_stock.password_requests(id,data) values((item->>'Request_ID')::uuid,item-array['Password','Password_Hash']);
   else raise exception 'Unsupported insert'; end if;
  end loop;
  return jsonb_build_object('success',true);
 elsif op='save' then
  i:=(payload->>'id')::uuid; item:=payload->'data';
  if t='Orders' then
   perform migration_stock.order_write(i,item,(payload->>'revision')::integer);
   select jsonb_build_object('id',id,'rowNumber',row_number,'revision',revision,'data',data) into result from migration_stock.order_rows where id=i;
  elsif t='User_Requests' then
   select * into q from migration_stock.user_requests where id=i for update;
   if not found then raise exception 'Request not found'; end if;
   if q.revision is distinct from (payload->>'revision')::integer then raise exception 'Request changed' using errcode='40001'; end if;
   update migration_stock.user_requests set status=coalesce(item->>'Status',status), reviewed_by=coalesce(item->>'Reviewed_By',reviewed_by),reviewed_at_raw=coalesce(item->>'Reviewed_At',reviewed_at_raw),reviewed_at=coalesce(migration_stock.parse_legacy_date(item->>'Reviewed_At'),reviewed_at),revision=revision+1,extra=extra||item where id=i returning * into q;
   result:=jsonb_build_object('id',i,'rowNumber',q.source_row,'revision',q.revision,'data',q.extra||jsonb_build_object('Request_ID',coalesce(q.legacy_request_id,q.id::text),'Username',q.username,'Name',q.display_name,'Department',q.department,'Status',q.status,'Created_At',q.created_at_raw,'Reviewed_At',q.reviewed_at_raw,'Reviewed_By',q.reviewed_by));
  elsif t='Password_Requests' then
   update migration_stock.password_requests set data=data||item,revision=revision+1 where id=i and revision=(payload->>'revision')::integer returning jsonb_build_object('id',id,'rowNumber',source_row,'revision',revision,'data',data) into result;
   if not found then raise exception 'Request changed' using errcode='40001'; end if;
  else raise exception 'Unsupported update'; end if;
  return result;
 elsif op='delete' and t='Orders' then
  update migration_stock.orders set deleted_at=now(),revision=revision+1 where id=(payload->>'id')::uuid and revision=(payload->>'revision')::integer and deleted_at is null;
  if not found then raise exception 'Order changed' using errcode='40001'; end if;
  return jsonb_build_object('success',true);
 elsif op='approve_registration' then
  select * into q from migration_stock.user_requests where legacy_request_id=payload->>'requestId' or id::text=payload->>'requestId' for update;
  if not found or q.status<>'PENDING' then raise exception 'Request unavailable'; end if;
  perform pg_advisory_xact_lock(hashtext(lower(q.username)));
  if exists(select 1 from migration_stock.user_profiles where lower(username)=lower(q.username)) then raise exception 'Username already exists'; end if;
  if not exists(select 1 from migration_stock.request_credentials where request_id=q.id) then raise exception 'Missing credential'; end if;
  insert into migration_stock.user_profiles(id,username,display_name,department) values(gen_random_uuid(),q.username,q.display_name,coalesce(nullif(payload->>'department',''),q.department)) returning * into u;
  insert into migration_stock.app_credentials select u.id,password_hash from migration_stock.request_credentials where request_id=q.id;
  update migration_stock.user_requests set status='APPROVED',reviewed_by=payload->>'reviewedBy',reviewed_at_raw=payload->>'reviewedAt',reviewed_at=migration_stock.parse_legacy_date(payload->>'reviewedAt'),revision=revision+1 where id=q.id;
  delete from migration_stock.request_credentials where request_id=q.id;
  return jsonb_build_object('success',true);
 elsif op='archive' then
  for item in select value from jsonb_array_elements(payload->'items') loop
   update migration_stock.orders set archived_at=now(),archive_name=item->>'archiveSheet',archived_by=payload->>'archivedBy',revision=revision+1 where id=(item->>'id')::uuid and revision=(item->>'revision')::integer and deleted_at is null and archived_at is null;
   if not found then raise exception 'Order changed' using errcode='40001'; end if;
  end loop;
  return jsonb_build_object('success',true);
 end if;
 raise exception 'Unsupported operation';
end $$;
revoke all on function public.stock_bridge(text,jsonb) from public,anon,authenticated;
grant execute on function public.stock_bridge(text,jsonb) to service_role;
revoke all on all functions in schema migration_stock from public,anon,authenticated;
revoke all on all tables in schema migration_stock from public,anon,authenticated;
notify pgrst,'reload schema';
commit;

