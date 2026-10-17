-- Synthetic agreement fixtures only. No balance, budget, policy or role updates.
begin;
do $$
declare company uuid:='10000000-0000-4000-8000-000000000001';
begin
 if not exists(select 1 from public.companies where id=company and is_demo) then raise exception 'Expected fictional company missing';end if;
 if not exists(select 1 from public.suppliers where id='20000000-0000-4000-8000-000000000001' and company_id=company) then raise exception 'Expected demo supplier missing';end if;
 if exists(select 1 from public.agreements where company_id=company and reference='DEMO-USD-001' and (supplier_id<>'20000000-0000-4000-8000-000000000001' or currency<>'USD' or amount<>800.00)) then raise exception 'Existing agreement DEMO-USD-001 differs from test fixture';end if;
 insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description)
 select '7efc692a-7e8b-59c7-95f1-c99d218c3333',company,'20000000-0000-4000-8000-000000000001','DEMO-USD-001','USD',800.00,'Acuerdo ficticio para pruebas multimoneda'
 where not exists(select 1 from public.agreements where company_id=company and reference='DEMO-USD-001');
 if not exists(select 1 from public.suppliers where id='20000000-0000-4000-8000-000000000001' and company_id=company) then raise exception 'Expected demo supplier missing';end if;
 if exists(select 1 from public.agreements where company_id=company and reference='DEMO-USD-1500' and (supplier_id<>'20000000-0000-4000-8000-000000000001' or currency<>'USD' or amount<>1500.00)) then raise exception 'Existing agreement DEMO-USD-1500 differs from test fixture';end if;
 insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description)
 select 'be0fd542-c8c5-5132-90df-dfe37d44cc93',company,'20000000-0000-4000-8000-000000000001','DEMO-USD-1500','USD',1500.00,'Acuerdo ficticio para pruebas multimoneda'
 where not exists(select 1 from public.agreements where company_id=company and reference='DEMO-USD-1500');
 if not exists(select 1 from public.suppliers where id='20000000-0000-4000-8000-000000000001' and company_id=company) then raise exception 'Expected demo supplier missing';end if;
 if exists(select 1 from public.agreements where company_id=company and reference='MC-USD-ABSOLUTE' and (supplier_id<>'20000000-0000-4000-8000-000000000001' or currency<>'USD' or amount<>3500.00)) then raise exception 'Existing agreement MC-USD-ABSOLUTE differs from test fixture';end if;
 insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description)
 select 'cad8116a-304d-5dbf-ba60-15fd0032640b',company,'20000000-0000-4000-8000-000000000001','MC-USD-ABSOLUTE','USD',3500.00,'Acuerdo ficticio para pruebas multimoneda'
 where not exists(select 1 from public.agreements where company_id=company and reference='MC-USD-ABSOLUTE');
 if not exists(select 1 from public.suppliers where id='20000000-0000-4000-8000-000000000003' and company_id=company) then raise exception 'Expected demo supplier missing';end if;
 if exists(select 1 from public.agreements where company_id=company and reference='MC-USD-DENIED' and (supplier_id<>'20000000-0000-4000-8000-000000000003' or currency<>'USD' or amount<>100.00)) then raise exception 'Existing agreement MC-USD-DENIED differs from test fixture';end if;
 insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description)
 select 'cd7301f2-9426-5ca8-a8dd-1c35f2f19232',company,'20000000-0000-4000-8000-000000000003','MC-USD-DENIED','USD',100.00,'Acuerdo ficticio para pruebas multimoneda'
 where not exists(select 1 from public.agreements where company_id=company and reference='MC-USD-DENIED');
 if not exists(select 1 from public.suppliers where id='20000000-0000-4000-8000-000000000001' and company_id=company) then raise exception 'Expected demo supplier missing';end if;
 if exists(select 1 from public.agreements where company_id=company and reference='MC-COP-AUTO' and (supplier_id<>'20000000-0000-4000-8000-000000000001' or currency<>'COP' or amount<>1000000.00)) then raise exception 'Existing agreement MC-COP-AUTO differs from test fixture';end if;
 insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description)
 select '1bfec13c-80f0-5645-a827-be1e2ef367e4',company,'20000000-0000-4000-8000-000000000001','MC-COP-AUTO','COP',1000000.00,'Acuerdo ficticio para pruebas multimoneda'
 where not exists(select 1 from public.agreements where company_id=company and reference='MC-COP-AUTO');
 if not exists(select 1 from public.suppliers where id='20000000-0000-4000-8000-000000000001' and company_id=company) then raise exception 'Expected demo supplier missing';end if;
 if exists(select 1 from public.agreements where company_id=company and reference='MC-COP-APPROVAL' and (supplier_id<>'20000000-0000-4000-8000-000000000001' or currency<>'COP' or amount<>5000000.00)) then raise exception 'Existing agreement MC-COP-APPROVAL differs from test fixture';end if;
 insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description)
 select '24cb41de-b9ec-5155-b22f-1b0f13d7dd1a',company,'20000000-0000-4000-8000-000000000001','MC-COP-APPROVAL','COP',5000000.00,'Acuerdo ficticio para pruebas multimoneda'
 where not exists(select 1 from public.agreements where company_id=company and reference='MC-COP-APPROVAL');
 if not exists(select 1 from public.suppliers where id='20000000-0000-4000-8000-000000000001' and company_id=company) then raise exception 'Expected demo supplier missing';end if;
 if exists(select 1 from public.agreements where company_id=company and reference='MC-COP-ABSOLUTE' and (supplier_id<>'20000000-0000-4000-8000-000000000001' or currency<>'COP' or amount<>13000000.00)) then raise exception 'Existing agreement MC-COP-ABSOLUTE differs from test fixture';end if;
 insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description)
 select '7087d7db-7f35-5275-a0c0-022f7421c71b',company,'20000000-0000-4000-8000-000000000001','MC-COP-ABSOLUTE','COP',13000000.00,'Acuerdo ficticio para pruebas multimoneda'
 where not exists(select 1 from public.agreements where company_id=company and reference='MC-COP-ABSOLUTE');
 if not exists(select 1 from public.suppliers where id='20000000-0000-4000-8000-000000000003' and company_id=company) then raise exception 'Expected demo supplier missing';end if;
 if exists(select 1 from public.agreements where company_id=company and reference='MC-COP-DENIED' and (supplier_id<>'20000000-0000-4000-8000-000000000003' or currency<>'COP' or amount<>100000.00)) then raise exception 'Existing agreement MC-COP-DENIED differs from test fixture';end if;
 insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description)
 select '9b825d96-5f2a-5104-9aea-17cad27e2a99',company,'20000000-0000-4000-8000-000000000003','MC-COP-DENIED','COP',100000.00,'Acuerdo ficticio para pruebas multimoneda'
 where not exists(select 1 from public.agreements where company_id=company and reference='MC-COP-DENIED');
 if not exists(select 1 from public.suppliers where id='20000000-0000-4000-8000-000000000002' and company_id=company) then raise exception 'Expected demo supplier missing';end if;
 if exists(select 1 from public.agreements where company_id=company and reference='DEMO-MXN-001' and (supplier_id<>'20000000-0000-4000-8000-000000000002' or currency<>'MXN' or amount<>15000.00)) then raise exception 'Existing agreement DEMO-MXN-001 differs from test fixture';end if;
 insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description)
 select '95b2efd6-9a3c-50c7-ab4b-ebaba61e889b',company,'20000000-0000-4000-8000-000000000002','DEMO-MXN-001','MXN',15000.00,'Acuerdo ficticio para pruebas multimoneda'
 where not exists(select 1 from public.agreements where company_id=company and reference='DEMO-MXN-001');
 if not exists(select 1 from public.suppliers where id='20000000-0000-4000-8000-000000000002' and company_id=company) then raise exception 'Expected demo supplier missing';end if;
 if exists(select 1 from public.agreements where company_id=company and reference='MC-MXN-APPROVAL' and (supplier_id<>'20000000-0000-4000-8000-000000000002' or currency<>'MXN' or amount<>25000.00)) then raise exception 'Existing agreement MC-MXN-APPROVAL differs from test fixture';end if;
 insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description)
 select '36e901d3-461c-546f-8739-924f50d385b8',company,'20000000-0000-4000-8000-000000000002','MC-MXN-APPROVAL','MXN',25000.00,'Acuerdo ficticio para pruebas multimoneda'
 where not exists(select 1 from public.agreements where company_id=company and reference='MC-MXN-APPROVAL');
 if not exists(select 1 from public.suppliers where id='20000000-0000-4000-8000-000000000002' and company_id=company) then raise exception 'Expected demo supplier missing';end if;
 if exists(select 1 from public.agreements where company_id=company and reference='MC-MXN-ABSOLUTE' and (supplier_id<>'20000000-0000-4000-8000-000000000002' or currency<>'MXN' or amount<>61000.00)) then raise exception 'Existing agreement MC-MXN-ABSOLUTE differs from test fixture';end if;
 insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description)
 select '22232055-9fc4-51af-9bd3-b0ab8e35dcb3',company,'20000000-0000-4000-8000-000000000002','MC-MXN-ABSOLUTE','MXN',61000.00,'Acuerdo ficticio para pruebas multimoneda'
 where not exists(select 1 from public.agreements where company_id=company and reference='MC-MXN-ABSOLUTE');
 if not exists(select 1 from public.suppliers where id='20000000-0000-4000-8000-000000000003' and company_id=company) then raise exception 'Expected demo supplier missing';end if;
 if exists(select 1 from public.agreements where company_id=company and reference='MC-MXN-DENIED' and (supplier_id<>'20000000-0000-4000-8000-000000000003' or currency<>'MXN' or amount<>1000.00)) then raise exception 'Existing agreement MC-MXN-DENIED differs from test fixture';end if;
 insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description)
 select '9d889d58-9323-5ad8-ada5-6eadc3e98433',company,'20000000-0000-4000-8000-000000000003','MC-MXN-DENIED','MXN',1000.00,'Acuerdo ficticio para pruebas multimoneda'
 where not exists(select 1 from public.agreements where company_id=company and reference='MC-MXN-DENIED');
end $$;
select reference,currency,amount from public.agreements where company_id='10000000-0000-4000-8000-000000000001' and (reference like 'MC-%' or reference in ('DEMO-USD-001','DEMO-USD-1500','DEMO-MXN-001')) order by currency,amount;
commit;
