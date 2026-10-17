-- Disposable database only. All fixtures and mutations roll back.
begin;
insert into auth.users(id) values('a0000000-0000-4000-8000-000000000001'),('a0000000-0000-4000-8000-000000000002'),('a0000000-0000-4000-8000-000000000003');
insert into public.company_members(company_id,user_id,role) values
 ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','admin'),
 ('10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002','approver');
insert into public.budgets(company_id,currency,period,total) values
 ('10000000-0000-4000-8000-000000000001','USD',date_trunc('month',now() at time zone 'America/Bogota')::date,4000) on conflict do nothing;
insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description) values
 ('30000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','APPROVAL-USD','USD',1500,'Approval test');
insert into public.documents(id,company_id,uploaded_by,original_name,storage_path,mime_type,byte_size,sha256)
select ('b0000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000001','review.pdf',
 '10000000-0000-4000-8000-000000000001/review-'||n,'application/pdf',100,lpad(n::text,64,'0') from generate_series(1,7) n;
insert into public.invoices(id,company_id,document_id,status,review_reasons,extraction_state)
select ('c0000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'10000000-0000-4000-8000-000000000001',('b0000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'needs_review','["Needs human review"]','completed' from generate_series(1,7) n;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare result jsonb; again jsonb; total numeric;company uuid:='10000000-0000-4000-8000-000000000001';supplier uuid:='20000000-0000-4000-8000-000000000001';agreement uuid:='30000000-0000-4000-8000-000000000001';
begin
 result:=public.payguard_confirm_invoice('c0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001',1,supplier,agreement,'INV-1','USD','800.00','2026-10-17','2026-10-20',true);
 if result->>'status'<>'authorized' then raise exception 'Valid reviewed invoice not authorized: %',result; end if;
 select reserved into total from public.wallets where company_id=company and currency='USD';if total<>800 then raise exception 'Wrong reserved balance'; end if;
 if (select balance from public.wallets where company_id=company and currency='USD')<>5000 then raise exception 'Confirmation debited balance'; end if;
 again:=public.payguard_confirm_invoice('c0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001',1,supplier,agreement,'INV-1','USD','800.00','2026-10-17','2026-10-20',true);
 if again<>result or (select reserved from public.wallets where company_id=company and currency='USD')<>800 then raise exception 'Retry duplicated reservation'; end if;
 begin perform public.payguard_confirm_invoice('c0000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000001',1,supplier,agreement,'INV-1','USD','801.00','2026-10-17','2026-10-20',true);raise exception 'Changed payload reused request';exception when invalid_parameter_value then null;end;
 begin perform public.payguard_confirm_invoice('c0000000-0000-4000-8000-000000000002',gen_random_uuid(),99,supplier,agreement,'INV-2','USD','800.00','2026-10-17','2026-10-20',true);raise exception 'Stale edit accepted';exception when serialization_failure then null;end;
 begin perform public.payguard_confirm_invoice('c0000000-0000-4000-8000-000000000002',gen_random_uuid(),1,supplier,agreement,'inv-1','USD','800.00','2026-10-17','2026-10-20',true);raise exception 'Duplicate number accepted';exception when unique_violation then null;end;
 if (select invoice_number from public.invoices where id='c0000000-0000-4000-8000-000000000002') is not null then raise exception 'Failed confirmation partially saved';end if;
 begin perform public.payguard_confirm_invoice('c0000000-0000-4000-8000-000000000002',gen_random_uuid(),1,supplier,agreement,'INV-2','USD','800.00','2026-10-17','2026-10-20',false);raise exception 'Unchecked confirmation accepted';exception when invalid_parameter_value then null;end;
 begin perform public.payguard_confirm_invoice('c0000000-0000-4000-8000-000000000002',gen_random_uuid(),1,'20000000-0000-4000-8000-000000000002',agreement,'INV-2','USD','800.00','2026-10-17','2026-10-20',true);raise exception 'Foreign supplier agreement accepted';exception when invalid_parameter_value then null;end;
 result:=public.payguard_confirm_invoice('c0000000-0000-4000-8000-000000000002',gen_random_uuid(),1,supplier,agreement,'INV-2','USD','900.00','2026-10-17','2026-10-20',true);
 if result->>'status'<>'blocked' then raise exception 'Agreement mismatch did not block';end if;
 result:=public.payguard_confirm_invoice('c0000000-0000-4000-8000-000000000003',gen_random_uuid(),1,supplier,'30000000-0000-4000-8000-000000000003','INV-3','USD','1500.00','2026-10-17','2026-10-20',true);
 if result->>'status'<>'pending_approval' then raise exception 'Approval threshold ignored';end if;
 result:=public.payguard_confirm_invoice('c0000000-0000-4000-8000-000000000004',gen_random_uuid(),1,supplier,null,'INV-4','USD','800.00','2026-10-17','2026-10-20',true);
 if result->>'status'<>'needs_review' then raise exception 'Missing agreement did not require review';end if;
 if (select reserved from public.wallets where company_id=company and currency='USD')<>800 then raise exception 'Blocked or pending invoice reserved funds';end if;
 if (select count(*) from public.invoice_reviews)<>4 then raise exception 'Unexpected review log count';end if;
 if (select count(*) from public.wallet_movements where kind='payment_simulated')<>0 then raise exception 'Confirmation executed payment';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 begin perform public.payguard_confirm_invoice('c0000000-0000-4000-8000-000000000005',gen_random_uuid(),1,'20000000-0000-4000-8000-000000000001',null,'INV-5','USD','800','2026-10-17','2026-10-20',true);raise exception 'Approver confirmed data';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.invoice_reviews) then raise exception 'Reviews leaked through RLS';end if;
 begin perform public.payguard_confirm_invoice('c0000000-0000-4000-8000-000000000005',gen_random_uuid(),1,'20000000-0000-4000-8000-000000000001',null,'INV-5','USD','800','2026-10-17','2026-10-20',true);raise exception 'Outsider confirmed data';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
