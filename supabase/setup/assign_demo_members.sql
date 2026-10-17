-- Manual setup, not a migration. Replace both UUID placeholders before running.
-- These are Supabase Auth user IDs, NOT dashboard organization/team IDs.
begin;
do $$
declare
 admin_user uuid := 'd34f5697-75fd-4d4f-8e68-c70df5f4e5ec';
 approver_user uuid := '4ff97f59-7f59-4f02-8878-442de6d630fa';
 demo_company uuid := '10000000-0000-4000-8000-000000000001';
begin
 if admin_user=approver_user then raise exception 'Use two different Auth users'; end if;
 if not exists(select 1 from auth.users where id=admin_user)
 or not exists(select 1 from auth.users where id=approver_user) then
  raise exception 'Create both users in Supabase Authentication first';
 end if;
 if not exists(select 1 from public.companies where id=demo_company) then
  raise exception 'Demo company missing: verify seed.sql';
 end if;
 insert into public.company_members(company_id,user_id,role)
 values(demo_company,admin_user,'admin'),(demo_company,approver_user,'approver')
 on conflict(company_id,user_id) do nothing;
end $$;
select company_id,user_id,role from public.company_members
where company_id='10000000-0000-4000-8000-000000000001';
commit;
