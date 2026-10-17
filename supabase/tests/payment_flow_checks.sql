-- Disposable local database only. Full review -> reserve -> pay/cancel, then rollback.
begin;
insert into auth.users(id) values('f0000000-0000-4000-8000-000000000001'),('f0000000-0000-4000-8000-000000000002'),('f0000000-0000-4000-8000-000000000003');
insert into public.company_members(company_id,user_id,role) values
 ('10000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','admin'),
 ('10000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000002','operator'),
 ('10000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000003','approver');
insert into public.budgets(company_id,currency,period,total) values
 ('10000000-0000-4000-8000-000000000001','USD',date_trunc('month',now() at time zone 'America/Bogota')::date,4000),
 ('10000000-0000-4000-8000-000000000001','MXN',date_trunc('month',now() at time zone 'America/Bogota')::date,80000),
 ('10000000-0000-4000-8000-000000000001','COP',date_trunc('month',now() at time zone 'America/Bogota')::date,16000000)
 on conflict do nothing;
insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description) values
 ('f1000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','TEST-500','USD',500,'Cancel test'),
 ('f1000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','TEST-1500','USD',1500,'Approval test'),
 ('f1000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','TEST-COP','COP',3000000,'COP test');
insert into public.documents(id,company_id,uploaded_by,original_name,storage_path,mime_type,byte_size,sha256)
select ('f2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000001','f0000000-0000-4000-8000-000000000001','payment.pdf',
 '10000000-0000-4000-8000-000000000001/payment-'||n,'application/pdf',100,repeat('f',60)||lpad(n::text,4,'0') from generate_series(1,7) n;
insert into public.invoices(id,company_id,document_id,status,review_reasons,extraction_state)
select ('f3000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000001',('f2000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'needs_review','["Needs review"]','completed' from generate_series(1,7) n;
update public.invoices set extraction_state='pending',status='received' where id='f3000000-0000-4000-8000-000000000007';
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare supplier uuid:='20000000-0000-4000-8000-000000000001';r jsonb;
begin
 perform public.payguard_confirm_invoice('f3000000-0000-4000-8000-000000000001',gen_random_uuid(),1,supplier,'30000000-0000-4000-8000-000000000001','PAY-1','USD','800','2026-10-17','2026-10-20',true);
 perform public.payguard_confirm_invoice('f3000000-0000-4000-8000-000000000002',gen_random_uuid(),1,supplier,'f1000000-0000-4000-8000-000000000001','PAY-2','USD','500','2026-10-17','2026-10-20',true);
 r:=public.payguard_confirm_invoice('f3000000-0000-4000-8000-000000000003',gen_random_uuid(),1,supplier,'f1000000-0000-4000-8000-000000000002','PAY-3','USD','1500','2026-10-17','2026-10-20',true);
 if r->>'status'<>'pending_approval' then raise exception 'Expected approval';end if;
 perform set_config('test.approve',r->>'decision_id',true);
 r:=public.payguard_confirm_invoice('f3000000-0000-4000-8000-000000000006',gen_random_uuid(),1,supplier,'f1000000-0000-4000-8000-000000000002','PAY-6','USD','1500','2026-10-17','2026-10-20',true);
 perform set_config('test.reject',r->>'decision_id',true);
 perform public.payguard_confirm_invoice('f3000000-0000-4000-8000-000000000004',gen_random_uuid(),1,'20000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','PAY-4','MXN','15000','2026-10-17','2026-10-20',true);
 perform public.payguard_confirm_invoice('f3000000-0000-4000-8000-000000000005',gen_random_uuid(),1,supplier,'f1000000-0000-4000-8000-000000000003','PAY-5','COP','3000000','2026-10-17','2026-10-20',true);
end $$;
reset role;
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 begin perform public.payguard_process_invoice('f3000000-0000-4000-8000-000000000001','pay',gen_random_uuid());raise exception 'Operator paid';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$
declare r jsonb;replay jsonb;request uuid:=gen_random_uuid();company uuid:='10000000-0000-4000-8000-000000000001';
begin
 r:=public.payguard_process_invoice('f3000000-0000-4000-8000-000000000001','pay',request);
 replay:=public.payguard_process_invoice('f3000000-0000-4000-8000-000000000001','pay',request);
 if r<>replay or r->>'status'<>'paid_simulated' then raise exception 'Payment not idempotent';end if;
 begin perform public.payguard_process_invoice('f3000000-0000-4000-8000-000000000001','pay',gen_random_uuid());raise exception 'Second debit permitted';exception when raise_exception then if sqlerrm='Second debit permitted' then raise;end if;end;
 if (select count(*) from public.wallet_movements where invoice_id='f3000000-0000-4000-8000-000000000001' and kind='payment_simulated')<>1 then raise exception 'Duplicate movement';end if;
 perform public.payguard_process_invoice('f3000000-0000-4000-8000-000000000002','cancel',gen_random_uuid());
 if (select reserved from public.wallets where company_id=company and currency='USD')<>0 then raise exception 'Cancellation did not release wallet';end if;
 perform public.payguard_process_invoice('f3000000-0000-4000-8000-000000000003','approve',gen_random_uuid(),current_setting('test.approve')::uuid,'Documento y acuerdo revisados');
 perform public.payguard_process_invoice('f3000000-0000-4000-8000-000000000003','pay',gen_random_uuid());
 perform public.payguard_process_invoice('f3000000-0000-4000-8000-000000000006','reject',gen_random_uuid(),current_setting('test.reject')::uuid,'No corresponde autorizar');
 perform public.payguard_process_invoice('f3000000-0000-4000-8000-000000000004','pay',gen_random_uuid());
 perform public.payguard_process_invoice('f3000000-0000-4000-8000-000000000005','pay',gen_random_uuid());
 if (select balance from public.wallets where company_id=company and currency='USD')<>2700 then raise exception 'USD balance mismatch';end if;
 if (select balance from public.wallets where company_id=company and currency='MXN')<>85000 then raise exception 'MXN balance mismatch';end if;
 if (select balance from public.wallets where company_id=company and currency='COP')<>17000000 then raise exception 'COP balance mismatch';end if;
 if exists(select 1 from public.wallets where company_id=company and reserved<>0) then raise exception 'Reservations not consumed/released';end if;
 if (select spent from public.budgets where company_id=company and currency='USD' and period=date_trunc('month',now() at time zone 'America/Bogota')::date)<>2300 then raise exception 'USD budget mismatch';end if;
 if (select count(*) from public.approvals where company_id=company and actor_id=auth.uid())<>2 then raise exception 'Approval reasons not audited';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','f0000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare claim jsonb;begin
 claim:=public.payguard_claim_extraction('f3000000-0000-4000-8000-000000000007');
 perform set_config('test.late_lease',claim->>'lease',true);
 perform public.payguard_process_invoice('f3000000-0000-4000-8000-000000000007','cancel',gen_random_uuid());
end $$;
reset role;
set local role service_role;
do $$ begin
 if public.payguard_finish_extraction('f3000000-0000-4000-8000-000000000007',current_setting('test.late_lease')::uuid,'{"fields":{}}',null) then raise exception 'Late extraction reopened invoice';end if;
 if not exists(select 1 from public.invoices where id='f3000000-0000-4000-8000-000000000007' and status='cancelled' and extraction_state='failed') then raise exception 'Closed invoice not protected';end if;
end $$;
reset role;
rollback;
