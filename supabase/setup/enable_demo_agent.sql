-- Explicitly enable autonomous SIMULATED payments for the existing fictional company.
begin;
do $$ begin
 if not exists(select 1 from public.companies where id='10000000-0000-4000-8000-000000000001' and is_demo) then raise exception 'Demo company not found';end if;
 update public.companies set agent_enabled=true where id='10000000-0000-4000-8000-000000000001' and is_demo;
end $$;
select name,agent_enabled from public.companies where id='10000000-0000-4000-8000-000000000001';
commit;
