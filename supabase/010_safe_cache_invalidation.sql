-- PostgREST sessions enforce safeupdate: DELETE must have a meaningful WHERE.
-- Only discard cache entries older than the newly committed data version.
begin;
create or replace function migration_stock.invalidate_read_cache() returns trigger
language plpgsql security definer set search_path='' as $$
declare new_revision bigint;
begin
 update migration_stock.read_epoch set revision=revision+1 where id=1 returning revision into new_revision;
 delete from migration_stock.read_cache where revision<new_revision;
 return null;
end $$;
revoke all on function migration_stock.invalidate_read_cache() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
