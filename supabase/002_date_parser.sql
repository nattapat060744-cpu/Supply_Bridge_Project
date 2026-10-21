begin;
create or replace function migration_stock.parse_legacy_date(v text) returns timestamp language plpgsql immutable set search_path='' as $$
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

commit;