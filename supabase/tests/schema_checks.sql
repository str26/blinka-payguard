-- Run after migration+seed from SQL Editor as postgres. All fixtures are rolled back.
begin;
do $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); u uuid:=gen_random_uuid(); s uuid:=gen_random_uuid(); w uuid:=gen_random_uuid(); v uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); i uuid:=gen_random_uuid(); c text;
begin
 perform set_config('payguard.test_company',a::text,true);
 perform set_config('request.jwt.claim.sub',u::text,true);
 insert into auth.users(id) values(u);
 insert into public.companies(id,name) values(a,'Test A'),(b,'Test B');
 insert into public.company_members(company_id,user_id,role) values(a,u,'operator');
 insert into public.suppliers(id,company_id,code,name,allowed) values(s,a,'TEST','Test',true);
 insert into public.wallets(id,company_id,currency,balance) values(w,a,'USD',100),(v,b,'USD',100);
 insert into public.documents(id,company_id,uploaded_by,original_name,storage_path,mime_type,byte_size,sha256)
 values(d,a,u,'test.pdf',a::text||'/test.pdf','application/pdf',10,repeat('a',64));
 insert into public.invoices(id,company_id,document_id,supplier_id,invoice_number,currency,amount,due_date)
 values(i,a,d,s,' TEST-001 ','USD',10,'2026-10-31');

 begin
  update public.wallets set reserved=101 where id=w;
  raise exception 'FAILED: over-reservation accepted';
 exception when check_violation then null; end;
 begin
  update public.wallets set balance=-1 where id=w;
  raise exception 'FAILED: negative balance accepted';
 exception when check_violation then null; end;
 begin
  update public.wallets set balance='NaN'::numeric where id=w;
  raise exception 'FAILED: NaN accepted';
 exception when check_violation then null; end;
 begin
  insert into public.policies(company_id,currency,version,automatic_limit,absolute_limit) values(a,'USD',1,200,100);
  raise exception 'FAILED: invalid limits accepted';
 exception when check_violation then null; end;
 insert into public.policies(company_id,currency,version,automatic_limit,absolute_limit) values(a,'USD',1,100,200);
 begin
  insert into public.policies(company_id,currency,version,automatic_limit,absolute_limit) values(a,'USD',2,100,200);
  raise exception 'FAILED: multiple active policies accepted';
 exception when unique_violation then null; end;
 begin
  insert into public.budgets(company_id,currency,period,total,reserved,spent) values(a,'USD','2026-10-01',100,60,50);
  raise exception 'FAILED: budget overspend accepted';
 exception when check_violation then null; end;
 begin
  insert into public.budgets(company_id,currency,period,total) values(a,'USD','2026-10-02',100);
  raise exception 'FAILED: nonmonthly period accepted';
 exception when check_violation then null; end;
 begin
  insert into public.agreements(company_id,supplier_id,reference,currency,amount,description) values(b,s,'BAD','USD',10,'cross-company');
  raise exception 'FAILED: cross-company supplier accepted';
 exception when foreign_key_violation then null; end;
 begin
  insert into public.invoices(company_id,document_id,supplier_id,invoice_number,currency,amount) values(a,d,s,'test-001','USD',10);
  raise exception 'FAILED: duplicate invoice number accepted';
 exception when unique_violation then null; end;
 begin
  insert into public.invoices(company_id,document_id,status) values(a,d,'authorized');
  raise exception 'FAILED: incomplete authorization accepted';
 exception when check_violation then null; end;
 begin
  insert into public.documents(company_id,uploaded_by,original_name,storage_path,mime_type,byte_size,sha256)
  values(a,u,'test2.pdf',a::text||'/test2.pdf','application/pdf',10,repeat('a',64));
  raise exception 'FAILED: duplicate file hash accepted';
 exception when unique_violation then null; end;
 begin
  insert into public.wallet_movements(company_id,wallet_id,currency,kind,amount,idempotency_key,description)
  values(a,v,'USD','opening_credit',10,gen_random_uuid(),'cross-company');
  raise exception 'FAILED: cross-company wallet accepted';
 exception when foreign_key_violation then null; end;
 begin
  insert into public.wallet_movements(company_id,wallet_id,currency,kind,amount,idempotency_key,description)
  values(a,w,'COP','opening_credit',10,gen_random_uuid(),'currency mismatch');
  raise exception 'FAILED: different wallet currency accepted';
 exception when foreign_key_violation then null; end;
 insert into public.wallet_movements(company_id,wallet_id,currency,kind,amount,idempotency_key,description)
 values(a,w,'USD','opening_credit',100,w,'test credit');
 begin
  insert into public.wallet_movements(company_id,wallet_id,currency,kind,amount,idempotency_key,description)
  values(a,w,'USD','opening_credit',100,w,'repeated request');
  raise exception 'FAILED: duplicate idempotency key accepted';
 exception when unique_violation then null; end;
 update public.wallets set reserved=40 where id=w;
 if (select available from public.wallets where id=w)<>60 then raise exception 'FAILED: incorrect available balance'; end if;
end $$;

set local role authenticated;
do $$
declare a uuid:=current_setting('payguard.test_company')::uuid; n integer;
begin
 select count(*) into n from public.companies;
 if n<>1 then raise exception 'FAILED: company read isolation'; end if;
 if not exists(select 1 from public.companies where id=a) then raise exception 'FAILED: own company invisible'; end if;
 select count(*) into n from public.wallets;
 if n<>1 then raise exception 'FAILED: wallet read isolation'; end if;
 begin
  update public.wallets set balance=999;
  raise exception 'FAILED: browser financial write permitted';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.company_members(company_id,user_id,role) values(a,auth.uid(),'admin');
  raise exception 'FAILED: browser role assignment permitted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$
begin
 begin
  perform 1 from public.wallets;
  raise exception 'FAILED: anonymous read permitted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'OK: 21 comprobaciones; cambios de prueba revertidos al finalizar.' as resultado;
rollback;
