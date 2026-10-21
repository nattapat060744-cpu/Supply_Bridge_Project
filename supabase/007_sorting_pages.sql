begin;
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
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'rowNumber',r.row_number,'revision',r.revision,'signature',md5(r.data::text),'data',r.data) order by array_position(ids,coalesce(r.data->>'Group_ID','no-batch')),r.row_number),'[]') into result from migration_stock.order_rows r where r.deleted_at is null and r.archived_at is null and coalesce(r.data->>'Group_ID','no-batch')=any(ids);
 return jsonb_build_object('items',result,'page',page_number,'pageSize',page_size,'total',total,'totalPages',greatest(ceil(total::numeric/page_size)::integer,1),'batchIds',coalesce(to_jsonb(ids),'[]'));
end $$;
revoke all on function public.stock_sorting_page(jsonb) from public,anon,authenticated;
grant execute on function public.stock_sorting_page(jsonb) to service_role;
notify pgrst,'reload schema';
commit;
