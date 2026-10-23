rollback;
-- Page complete purchase bills / stock products before constructing row JSON.
-- Use the transactional epoch for cheap unchanged polls, with a minute tick for
-- the purchase screen's rolling 24-hour ORDERED visibility rule.
begin;
create or replace function public.stock_work_page(payload jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 kind text:=payload->>'kind'; q text:=lower(coalesce(payload->>'q','')); supplier text:=coalesce(payload->>'supplier','all');
 page_size integer; page_number integer:=greatest(coalesce((payload->>'page')::integer,1),1);
 epoch bigint; data_version text; version text; keys text[]; chosen text[]; ids uuid[]; result jsonb; issue_ids uuid[]; issues jsonb; suppliers jsonb;
 total integer; response jsonb; now_local timestamp:=clock_timestamp() at time zone 'Asia/Bangkok';
begin
 if kind not in('purchase','stock') or kind is null then raise exception 'Invalid work page' using errcode='22023';end if;
 page_size:=case when kind='purchase' then 6 else 10 end;
 select revision into epoch from migration_stock.read_epoch where id=1 for share;
 data_version:='epoch:'||epoch::text;
 version:=data_version||':'||kind||case when kind='purchase' then ':'||floor(extract(epoch from clock_timestamp())/60)::text else '' end;
 if payload->>'version'=version then return jsonb_build_object('unchanged',true,'version',version,'dataVersion',data_version);end if;

 with candidates as materialized (
  select o.id,o.source_row,o.created_at,o.product_name_snapshot,
   case when kind='purchase' then coalesce(nullif(g.legacy_group_id,''),'ทั่วไป') else coalesce(p.legacy_product_id,'') end k,
   (q='' or strpos(lower(concat_ws(' ',o.product_name_snapshot,p.legacy_product_id,g.legacy_group_id,o.extra->>'Group_Name',s.legacy_name)),q)>0) matches
  from migration_stock.orders o
  left join migration_stock.order_groups g on g.id=o.group_id
  left join migration_stock.products p on p.id=o.product_id
  left join migration_stock.suppliers s on s.id=o.supplier_id
  where o.deleted_at is null and o.archived_at is null
   and ((kind='stock' and o.status='ORDERED') or (kind='purchase' and(o.status='PENDING' or(o.status='ORDERED' and coalesce(o.created_at_p,o.created_at)>=now_local-interval '24 hours'))))
   and (kind='purchase' or supplier='all' or coalesce(s.legacy_name,'')=supplier)
 ), groups as (
  select k,max(created_at) dt,(array_agg(product_name_snapshot order by source_row,id))[1] name
  from candidates where kind='purchase' or matches group by k having kind='stock' or bool_or(matches)
 ) select coalesce(array_agg(k order by
    case when kind='stock' then name end collate "und-x-icu" asc,
    case when kind='purchase' then dt end desc nulls last,k collate "und-x-icu" desc),'{}') into keys from groups;
 total:=cardinality(keys);
 page_number:=least(page_number,greatest(ceil(total::numeric/page_size)::integer,1));
 chosen:=keys[((page_number-1)*page_size+1):(page_number*page_size)];
 select coalesce(array_agg(o.id),'{}') into ids from migration_stock.orders o
  left join migration_stock.order_groups g on g.id=o.group_id
  left join migration_stock.products p on p.id=o.product_id
  left join migration_stock.suppliers s on s.id=o.supplier_id
 where o.deleted_at is null and o.archived_at is null
  and ((kind='stock' and o.status='ORDERED') or (kind='purchase' and(o.status='PENDING' or(o.status='ORDERED' and coalesce(o.created_at_p,o.created_at)>=now_local-interval '24 hours'))))
  and (case when kind='purchase' then coalesce(nullif(g.legacy_group_id,''),'ทั่วไป') else coalesce(p.legacy_product_id,'') end)=any(chosen)
  and (kind='purchase' or((supplier='all' or coalesce(s.legacy_name,'')=supplier) and(q='' or strpos(lower(concat_ws(' ',o.product_name_snapshot,p.legacy_product_id,g.legacy_group_id,o.extra->>'Group_Name',s.legacy_name)),q)>0)));
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'rowNumber',r.row_number,'revision',r.revision,'data',r.data) order by
  array_position(chosen,case when kind='purchase' then coalesce(nullif(r.data->>'Group_ID',''),'ทั่วไป') else coalesce(r.data->>'Product_ID','') end),r.row_number),'[]') into result
 from migration_stock.order_rows r where r.id=any(ids);
 response:=jsonb_build_object('items',result,'page',page_number,'total',total,'totalPages',greatest(ceil(total::numeric/page_size)::integer,1),'pageSize',page_size,'version',version,'dataVersion',data_version,'groupKeys',to_jsonb(chosen));

 if payload->>'metadataVersion' is distinct from data_version then
  -- Global issue tracking remains complete, independently of the visible page.
  select coalesce(array_agg(id),'{}') into issue_ids from(
   select distinct on(coalesce(p.legacy_product_id,'')) o.id
   from migration_stock.orders o left join migration_stock.products p on p.id=o.product_id
   left join migration_stock.receipt_snapshots r on r.order_id=o.id
   where o.deleted_at is null and o.archived_at is null
    and o.status in('ORDERED','COMPLETED','RECEIVED') and(kind='purchase' or o.status<>'RECEIVED')
    and coalesce(r.note_stock,'') not like '%ตัดบิลจบ%'
    and ((o.status='ORDERED' and(coalesce(r.recv_carton,0)>0 or coalesce(r.recv_qty,0)>0))
      or(o.status<>'ORDERED' and(kind='stock' or r.recv_carton is not null or r.recv_qty is not null)))
    and(coalesce(r.recv_carton,0)<>coalesce(o.order_carton,0) or coalesce(r.recv_qty,0)<>coalesce(o.qty_per_carton,0))
   order by coalesce(p.legacy_product_id,''),o.source_row,o.id
  ) selected_issues;
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'rowNumber',r.row_number,'revision',r.revision,'data',r.data) order by r.row_number),'[]') into issues from migration_stock.order_rows r where r.id=any(issue_ids);
  select coalesce(jsonb_agg(name order by name),'[]') into suppliers from(
   select distinct s.legacy_name name from migration_stock.orders o join migration_stock.suppliers s on s.id=o.supplier_id
   where o.deleted_at is null and o.archived_at is null and o.status in('ORDERED','COMPLETED') and s.legacy_name<>''
  ) names;
  response:=response||jsonb_build_object('issues',issues,'suppliers',suppliers);
 end if;
 return response;
end $$;
revoke all on function public.stock_work_page(jsonb) from public,anon,authenticated;
grant execute on function public.stock_work_page(jsonb) to service_role;
notify pgrst,'reload schema';
do $$
declare k text; a jsonb; b jsonb; c jsonb; expected integer; size integer; selected_count integer; x text;
begin
 foreach k in array array['purchase','stock'] loop
  size:=case when k='purchase' then 6 else 10 end;
  a:=public.stock_work_page(jsonb_build_object('kind',k,'page',1));
  b:=public.stock_work_page(jsonb_build_object('kind',k,'page',2,'metadataVersion',a->>'dataVersion'));
  select count(distinct case when k='purchase' then coalesce(nullif(g.legacy_group_id,''),'ทั่วไป') else coalesce(p.legacy_product_id,'') end) into expected
  from migration_stock.orders o left join migration_stock.order_groups g on g.id=o.group_id left join migration_stock.products p on p.id=o.product_id
  where o.deleted_at is null and o.archived_at is null and((k='stock' and o.status='ORDERED') or(k='purchase' and(o.status='PENDING' or(o.status='ORDERED' and coalesce(o.created_at_p,o.created_at)>=(clock_timestamp() at time zone 'Asia/Bangkok')-interval '24 hours'))));
  if (a->>'total')::integer<>expected then raise exception 'Wrong % total',k;end if;
  if jsonb_array_length(a->'groupKeys')>size then raise exception 'Page too large';end if;
  if (a->>'totalPages')::integer>1 and exists(select 1 from jsonb_array_elements(a->'items') aa(item) join jsonb_array_elements(b->'items') bb(item) on aa.item->>'id'=bb.item->>'id') then raise exception 'Pages overlap';end if;
  select count(*) into selected_count from migration_stock.orders o
   left join migration_stock.order_groups g on g.id=o.group_id left join migration_stock.products p on p.id=o.product_id
   where o.deleted_at is null and o.archived_at is null and((k='stock' and o.status='ORDERED') or(k='purchase' and(o.status='PENDING' or(o.status='ORDERED' and coalesce(o.created_at_p,o.created_at)>=(clock_timestamp() at time zone 'Asia/Bangkok')-interval '24 hours'))))
   and (case when k='purchase' then coalesce(nullif(g.legacy_group_id,''),'ทั่วไป') else coalesce(p.legacy_product_id,'') end) in(select jsonb_array_elements_text(a->'groupKeys'));
  if jsonb_array_length(a->'items')<>selected_count then raise exception 'Incomplete % group',k;end if;
  if b?'issues' or b?'suppliers' then raise exception 'Unchanged metadata reloaded';end if;
  c:=public.stock_work_page(jsonb_build_object('kind',k,'version',a->>'version'));
  if c->>'unchanged'<>'true' or length(c::text)>200 then raise exception 'Unchanged poll not compact';end if;
  c:=public.stock_work_page(jsonb_build_object('kind',k,'page',999999,'metadataVersion',a->>'dataVersion'));
  if c->>'page'<>c->>'totalPages' then raise exception 'Page not clamped';end if;
  c:=public.stock_work_page(jsonb_build_object('kind',k,'q','__no_such_work_page__','metadataVersion',a->>'dataVersion'));
  if c->>'total'<>'0' or jsonb_array_length(c->'items')<>0 then raise exception 'Empty search failed';end if;
  x:=a->'items'->0->'data'->>'Product_ID';
  if coalesce(x,'')<>'' then
   c:=public.stock_work_page(jsonb_build_object('kind',k,'q',x,'metadataVersion',a->>'dataVersion'));
   if (c->>'total')::integer<1 then raise exception 'Product search failed';end if;
  end if;
 end loop;
 if has_function_privilege('anon','public.stock_work_page(jsonb)','execute') or has_function_privilege('authenticated','public.stock_work_page(jsonb)','execute') then raise exception 'Public work page access';end if;
end $$;
select 'PASS: complete groups, totals, disjoint pages, metadata reuse, compact unchanged polls, search, page clamp and private access' result;

rollback;
