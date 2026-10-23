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
