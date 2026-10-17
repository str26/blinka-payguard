-- Add one synthetic agreement for the human approval demo. Does not reset balances.
begin;
do $$
declare company uuid:='10000000-0000-4000-8000-000000000001';supplier uuid:='20000000-0000-4000-8000-000000000001';
begin
 if not exists(select 1 from public.companies where id=company and is_demo) or not exists(select 1 from public.suppliers where id=supplier and company_id=company and code='DEMO-CO' and allowed) then
  raise exception 'Expected demo company and allowed DEMO-CO supplier are missing';
 end if;
 insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description)
 values('30000000-0000-4000-8000-000000001500',company,supplier,'DEMO-USD-1500','USD',1500,'Servicio ficticio sujeto a aprobación humana')
 on conflict do nothing;
 if not exists(select 1 from public.agreements where company_id=company and supplier_id=supplier and reference='DEMO-USD-1500' and currency='USD' and amount=1500) then
  raise exception 'The existing agreement differs from the expected demo data';
 end if;
end $$;
select reference,currency,amount from public.agreements where company_id='10000000-0000-4000-8000-000000000001' and reference in ('DEMO-USD-001','DEMO-USD-1500') order by reference;
commit;
