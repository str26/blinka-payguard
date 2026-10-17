-- Disposable local database only. Fixtures and monetary mutations roll back.
begin;
insert into auth.users(id) values('eb000000-0000-4000-8000-000000000001'),('eb000000-0000-4000-8000-000000000002'),('eb000000-0000-4000-8000-000000000003'),('eb000000-0000-4000-8000-000000000004');
insert into public.companies(id,name) values('ea000000-0000-4000-8000-000000000001','Refund Demo');
insert into public.company_members(company_id,user_id,role) values
 ('ea000000-0000-4000-8000-000000000001','eb000000-0000-4000-8000-000000000001','admin'),
 ('ea000000-0000-4000-8000-000000000001','eb000000-0000-4000-8000-000000000002','operator'),
 ('ea000000-0000-4000-8000-000000000001','eb000000-0000-4000-8000-000000000003','approver');
insert into public.suppliers(id,company_id,code,name,allowed) values('ec000000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000001','REFUND','Refund supplier',true);
insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description) values('ed000000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000001','ec000000-0000-4000-8000-000000000001','REFUND-USD','USD',800,'Refund test');
insert into public.wallets(company_id,currency,balance) values('ea000000-0000-4000-8000-000000000001','USD',5000);
insert into public.budgets(company_id,currency,period,total) values('ea000000-0000-4000-8000-000000000001','USD',date_trunc('month',now() at time zone 'America/Bogota')::date,4000);
insert into public.policies(company_id,currency,version,automatic_limit,absolute_limit) values('ea000000-0000-4000-8000-000000000001','USD',1,1000,3000);
insert into public.documents(id,company_id,uploaded_by,original_name,storage_path,mime_type,byte_size,sha256) values('ee000000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000001','eb000000-0000-4000-8000-000000000001','refund.pdf','ea000000-0000-4000-8000-000000000001/refund','application/pdf',100,repeat('a',64));
insert into public.invoices(id,company_id,document_id,status,review_reasons,extraction_state) values('ef000000-0000-4000-8000-000000000001','ea000000-0000-4000-8000-000000000001','ee000000-0000-4000-8000-000000000001','needs_review','["Review"]','completed');
select set_config('request.jwt.claim.sub','eb000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 perform public.payguard_confirm_invoice('ef000000-0000-4000-8000-000000000001',gen_random_uuid(),1,'ec000000-0000-4000-8000-000000000001','ed000000-0000-4000-8000-000000000001','REFUND-1','USD','800','2026-10-17','2026-10-20',true);
 begin perform public.payguard_refund_invoice('ef000000-0000-4000-8000-000000000001',gen_random_uuid(),'200','Unpaid');raise exception 'Unpaid invoice refunded';exception when object_not_in_prerequisite_state then null;end;
 perform public.payguard_process_invoice('ef000000-0000-4000-8000-000000000001','pay',gen_random_uuid());
end $$;
reset role;
-- Move the consumed budget to a previous period and create a different current budget.
-- A refund must adjust the referenced original budget, never pick the current month.
update public.budgets set period=(date_trunc('month',now() at time zone 'America/Bogota')-interval '1 month')::date where company_id='ea000000-0000-4000-8000-000000000001';
insert into public.budgets(company_id,currency,period,total) values('ea000000-0000-4000-8000-000000000001','USD',date_trunc('month',now() at time zone 'America/Bogota')::date,777);
set local role authenticated;
do $$
declare r jsonb;again jsonb;request uuid:=gen_random_uuid();company uuid:='ea000000-0000-4000-8000-000000000001';invoice uuid:='ef000000-0000-4000-8000-000000000001';
begin
 r:=public.payguard_refund_invoice(invoice,request,'200.00','Servicio devuelto parcialmente');
 again:=public.payguard_refund_invoice(invoice,request,'200.00','Servicio devuelto parcialmente');
 if r<>again or r->>'refundable_remaining'<>'600.00' then raise exception 'Partial refund replay mismatch';end if;
 if (select balance from public.wallets where company_id=company)<>4400 then raise exception 'Wallet credited more than once';end if;
 if (select spent from public.budgets where company_id=company and total=4000)<>600 then raise exception 'Original budget not reversed';end if;
 if (select spent from public.budgets where company_id=company and total=777)<>0 then raise exception 'Wrong current budget changed';end if;
 if (select count(*) from public.wallet_movements where invoice_id=invoice and kind='refund_received')<>1 then raise exception 'Refund movement duplicate';end if;
 if exists(select 1 from public.wallet_movements m where m.invoice_id=invoice and m.kind='refund_received' and m.original_movement_id is distinct from (select p.id from public.wallet_movements p where p.invoice_id=invoice and p.kind='payment_simulated')) then raise exception 'Refund linked to wrong movement';end if;
 begin perform public.payguard_refund_invoice(invoice,request,'201','Changed request');raise exception 'Changed payload reused request';exception when invalid_parameter_value then null;end;
 begin perform public.payguard_refund_invoice(invoice,gen_random_uuid(),'601','Too much');raise exception 'Over refund accepted';exception when invalid_parameter_value then null;end;
 begin perform public.payguard_refund_invoice(invoice,gen_random_uuid(),'-1','Negative');raise exception 'Negative refund accepted';exception when invalid_parameter_value then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','eb000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 begin perform public.payguard_refund_invoice('ef000000-0000-4000-8000-000000000001',gen_random_uuid(),'1','Operator');raise exception 'Operator refunded';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','eb000000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ begin
 begin perform public.payguard_refund_invoice('ef000000-0000-4000-8000-000000000001',gen_random_uuid(),'1','Outsider');raise exception 'Outsider refunded';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','eb000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$
declare r jsonb;company uuid:='ea000000-0000-4000-8000-000000000001';invoice uuid:='ef000000-0000-4000-8000-000000000001';
begin
 r:=public.payguard_refund_invoice(invoice,gen_random_uuid(),'600.00','Resto devuelto');
 if r->>'refundable_remaining'<>'0.00' or (select balance from public.wallets where company_id=company)<>5000 then raise exception 'Full refund mismatch';end if;
 if (select spent from public.budgets where company_id=company and total=4000)<>0 then raise exception 'Original expense not fully reversed';end if;
 if (select amount from public.wallet_movements where invoice_id=invoice and kind='payment_simulated')<>800 then raise exception 'Original movement mutated';end if;
 if (select count(*) from public.wallet_movements where invoice_id=invoice and kind='refund_received')<>2 then raise exception 'Partial refund records missing';end if;
 if (select status from public.invoices where id=invoice)<>'paid_simulated' then raise exception 'Refund reopened invoice';end if;
 begin perform public.payguard_refund_invoice(invoice,gen_random_uuid(),'0.01','Excess');raise exception 'Refund beyond paid total accepted';exception when invalid_parameter_value then null;end;
 begin perform public.payguard_process_invoice(invoice,'pay',gen_random_uuid());raise exception 'Refunded invoice paid twice';exception when raise_exception then if sqlerrm='Refunded invoice paid twice' then raise;end if;end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.payguard_refund_invoice(gen_random_uuid(),gen_random_uuid(),'1','Anon');raise exception 'Anon refund allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role service_role;
do $$ begin
 begin perform public.payguard_refund_invoice(gen_random_uuid(),gen_random_uuid(),'1','Service');raise exception 'Service key refunded without user';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
