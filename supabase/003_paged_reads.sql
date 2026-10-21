begin;
create index if not exists orders_history_date on migration_stock.orders(created_at desc,source_row desc) where deleted_at is null;
create index if not exists orders_active_status on migration_stock.orders(status) where deleted_at is null;
create or replace function public.stock_history(payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare page_size integer:=least(greatest(coalesce((payload->>'pageSize')::integer,20),1),500); page_number integer:=greatest(coalesce((payload->>'page')::integer,1),1); total bigint; result jsonb; suppliers jsonb:='[]';
begin
 select count(*) into total from migration_stock.orders o
 left join migration_stock.products p on p.id=o.product_id left join migration_stock.suppliers s on s.id=o.supplier_id left join migration_stock.order_groups g on g.id=o.group_id
 where o.deleted_at is null and (coalesce(payload->>'status','ALL')='ALL' or o.status=payload->>'status')
 and (coalesce(payload->>'supplier','ALL')='ALL' or s.legacy_name=payload->>'supplier')
 and (coalesce(payload->>'q','')='' or strpos(lower(concat_ws(' ',o.product_name_snapshot,p.legacy_product_id,g.legacy_group_id,o.extra->>'Group_Name',s.legacy_name,o.invoice_no)),lower(payload->>'q'))>0);
 page_number:=least(page_number,greatest(ceil(total::numeric/page_size)::integer,1));
 select coalesce(jsonb_agg(x.item),'[]') into result from (
 select jsonb_build_object(
 'rowId',o.source_row,'rowUid',o.id,'status',o.status,'groupId',coalesce(nullif(o.extra->>'Group_Name',''),g.legacy_group_id,''),'productName',o.product_name_snapshot,'supplier',coalesce(s.legacy_name,''),
 'orderCarton',coalesce(o.order_carton::text,'0'),'qtyPerCarton',coalesce(o.qty_per_carton::text,'0'),'cartonUnit',coalesce(o.carton_unit,''),'innerUnit',coalesce(o.inner_unit,''),
 'recvCarton',coalesce(r.recv_carton::text,'-'),'recvQty',coalesce(r.recv_qty::text,'0'),'recvUnit',coalesce(r.recv_unit,''),'recvQtyUnit',coalesce(r.recv_qty_unit,''),
 'invoiceNo',coalesce(o.invoice_no,'-'),'recvDate',case when r.recv_date is null then r.recv_date_raw else to_char(r.recv_date,'YYYY-MM-DD"T"HH24:MI:SS')||'+07:00' end,
 'receiver',coalesce(r.receiver_name,'-'),'createdAt',case when o.created_at is null then o.created_at_raw else to_char(o.created_at,'YYYY-MM-DD"T"HH24:MI:SS')||'+07:00' end,
 'noteRequest',coalesce(o.note_request,''),'notePurchase',coalesce(o.note_purchase,''),'noteStock',coalesce(r.note_stock,''),'sourceSheet',coalesce(o.archive_name,'Orders')) as item
 from migration_stock.orders o left join migration_stock.suppliers s on s.id=o.supplier_id left join migration_stock.products p on p.id=o.product_id left join migration_stock.order_groups g on g.id=o.group_id left join migration_stock.receipt_snapshots r on r.order_id=o.id
 where o.deleted_at is null and (coalesce(payload->>'status','ALL')='ALL' or o.status=payload->>'status')
 and (coalesce(payload->>'supplier','ALL')='ALL' or s.legacy_name=payload->>'supplier')
 and (coalesce(payload->>'q','')='' or strpos(lower(concat_ws(' ',o.product_name_snapshot,p.legacy_product_id,g.legacy_group_id,o.extra->>'Group_Name',s.legacy_name,o.invoice_no)),lower(payload->>'q'))>0)
 order by
 case when payload->>'sort'='NAME_ASC' then o.product_name_snapshot end asc,
 case when payload->>'sort'='NAME_DESC' then o.product_name_snapshot end desc,
 case when payload->>'sort'='OLDEST' then o.created_at end asc nulls last,
 case when coalesce(payload->>'sort','NEWEST')='NEWEST' then o.created_at end desc nulls last,
 case when payload->>'sort'='OLDEST' then o.source_row end asc,o.source_row desc,o.id
 limit page_size offset (page_number-1)*page_size
 ) x;
 if coalesce((payload->>'includeSuppliers')::boolean,false) then
  select coalesce(jsonb_agg(name order by name),'[]') into suppliers from(select distinct s.legacy_name name from migration_stock.suppliers s join migration_stock.orders o on o.supplier_id=s.id where o.deleted_at is null) x;
 end if;
 return jsonb_build_object('items',result,'page',page_number,'pageSize',page_size,'total',total,'totalPages',greatest(ceil(total::numeric/page_size),1),'suppliers',suppliers);
end $$;
create or replace function public.stock_orders(payload jsonb default '{}') returns jsonb language sql security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'rowNumber',row_number,'revision',revision,'signature',md5(data::text),'data',data) order by row_number),'[]') from migration_stock.order_rows where deleted_at is null and(case when coalesce(payload->>'table','Orders')='Orders' then archived_at is null else archive_name=payload->>'table' end);
$$;
revoke all on function public.stock_history(jsonb),public.stock_orders(jsonb) from public,anon,authenticated;
grant execute on function public.stock_history(jsonb),public.stock_orders(jsonb) to service_role;
create or replace function public.stock_order_changes(payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare version text; items jsonb;
begin
 select md5(coalesce(string_agg(o.id::text||':'||o.revision::text,',' order by o.id),'')) into version from migration_stock.orders o where deleted_at is null and archived_at is null;
 if version=payload->>'version' then return jsonb_build_object('version',version,'items',null); end if;
 select coalesce(jsonb_agg(jsonb_build_object('Row_UID',id,'Revision',revision,'Group_ID',data->>'Group_ID','Group_Name',data->>'Group_Name','ChangeSignature',md5(data::text)) order by row_number),'[]') into items from migration_stock.order_rows where deleted_at is null and archived_at is null;
 return jsonb_build_object('version',version,'items',items);
end $$;
revoke all on function public.stock_order_changes(jsonb) from public,anon,authenticated;
grant execute on function public.stock_order_changes(jsonb) to service_role;
notify pgrst,'reload schema';
commit;
