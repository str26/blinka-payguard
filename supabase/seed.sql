-- Synthetic demo only. Run after migration. Repeat execution leaves existing rows untouched.
begin;
insert into public.companies(id,name) values('10000000-0000-4000-8000-000000000001','Atlas Demo Global LLC') on conflict do nothing;
insert into public.suppliers(id,company_id,code,name,allowed) values
('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','DEMO-CO','Andes Demo Services',true),
('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','DEMO-MX','Pacifico Demo Studio',true),
('20000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','DEMO-NEW','Proveedor Demo Pendiente',false)
on conflict do nothing;
insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description) values
('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','DEMO-USD-001','USD',800,'Servicio ficticio mensual'),
('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002','DEMO-MXN-001','MXN',15000,'Diseno ficticio mensual')
on conflict do nothing;
insert into public.policies(company_id,currency,version,automatic_limit,absolute_limit) values
('10000000-0000-4000-8000-000000000001','USD',1,1000,3000),
('10000000-0000-4000-8000-000000000001','COP',1,4000000,12000000),
('10000000-0000-4000-8000-000000000001','MXN',1,20000,60000)
on conflict do nothing;
insert into public.wallets(id,company_id,currency,balance) values
('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','USD',5000),
('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','COP',20000000),
('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','MXN',100000)
on conflict do nothing;
insert into public.budgets(company_id,currency,period,total) values
('10000000-0000-4000-8000-000000000001','USD','2026-10-01',4000),
('10000000-0000-4000-8000-000000000001','COP','2026-10-01',16000000),
('10000000-0000-4000-8000-000000000001','MXN','2026-10-01',80000)
on conflict do nothing;
insert into public.wallet_movements(company_id,wallet_id,currency,kind,amount,idempotency_key,description) values
('10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','USD','opening_credit',5000,'50000000-0000-4000-8000-000000000001','Saldo inicial ficticio USD'),
('10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000002','COP','opening_credit',20000000,'50000000-0000-4000-8000-000000000002','Saldo inicial ficticio COP'),
('10000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003','MXN','opening_credit',100000,'50000000-0000-4000-8000-000000000003','Saldo inicial ficticio MXN')
on conflict do nothing;
commit;
