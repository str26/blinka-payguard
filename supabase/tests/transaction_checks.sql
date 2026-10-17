-- SQL Editor as postgres after migrations 001 and 002. All fixtures roll back.
begin;
create function payguard_private.test_invoice(c uuid,u uuid,s uuid,a numeric) returns uuid
language plpgsql set search_path='' as $$
declare d uuid:=gen_random_uuid(); g uuid:=gen_random_uuid(); i uuid:=gen_random_uuid();
begin
 insert into public.documents(id,company_id,uploaded_by,original_name,storage_path,mime_type,byte_size,sha256)
 values(d,c,u,'ficticia.pdf',c::text||'/'||d::text||'.pdf','application/pdf',100,replace(d::text,'-','')||replace(d::text,'-',''));
 insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description)
 values(g,c,s,g::text,'USD',a,'Acuerdo ficticio de prueba');
 insert into public.invoices(id,company_id,document_id,supplier_id,agreement_id,invoice_number,currency,amount,due_date)
 values(i,c,d,s,g,i::text,'USD',a,current_date+10);
 return i;
end $$;

do $$
declare
 c uuid:=gen_random_uuid(); c2 uuid:=gen_random_uuid(); admin_user uuid:=gen_random_uuid(); operator_user uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid();
 supplier uuid:=gen_random_uuid(); supplier2 uuid:=gen_random_uuid(); wallet uuid:=gen_random_uuid(); budget uuid:=gen_random_uuid(); policy uuid:=gen_random_uuid();
 i uuid; j uuid; request uuid; request2 uuid; decision uuid; r jsonb; replay jsonb; v integer;
begin
 insert into auth.users(id) values(admin_user),(operator_user),(outsider);
 insert into public.companies(id,name) values(c,'Transacciones Demo'),(c2,'Otra Empresa Demo');
 insert into public.company_members(company_id,user_id,role) values(c,admin_user,'admin'),(c,operator_user,'operator'),(c2,outsider,'admin');
 insert into public.suppliers(id,company_id,code,name,allowed) values(supplier,c,'TEST','Proveedor ficticio',true),(supplier2,c2,'TEST2','Otro proveedor',true);
 insert into public.wallets(id,company_id,currency,balance) values(wallet,c,'USD',5000);
 insert into public.budgets(id,company_id,currency,period,total) values(budget,c,'USD',date_trunc('month',transaction_timestamp() at time zone 'America/Bogota')::date,4000);
 insert into public.policies(id,company_id,currency,version,automatic_limit,absolute_limit) values(policy,c,'USD',1,1000,3000);
 perform set_config('request.jwt.claim.sub',admin_user::text,true);

 i:=payguard_private.test_invoice(c,admin_user,supplier,800); request:=gen_random_uuid();
 r:=public.payguard_process_invoice(i,'evaluate',request);
 if r->>'status'<>'authorized' then raise exception 'FAIL automatic authorization: %',r; end if;
 if (select reserved from public.wallets where id=wallet)<>800 or (select reserved from public.budgets where id=budget)<>800 then raise exception 'FAIL paired reservation'; end if;
 begin
  update public.invoices set amount=801 where id=i;
  raise exception 'FAIL reserved invoice edited';
 exception when raise_exception then if sqlerrm='FAIL reserved invoice edited' then raise; end if; end;
 replay:=public.payguard_process_invoice(i,'evaluate',request);
 if replay<>r or (select count(*) from public.decisions where invoice_id=i)<>1 then raise exception 'FAIL evaluation idempotency'; end if;
 begin
  perform public.payguard_process_invoice(i,'pay',request);
  raise exception 'FAIL reused key accepted';
 exception when raise_exception then if sqlerrm='FAIL reused key accepted' then raise; end if; end;
 request2:=gen_random_uuid(); r:=public.payguard_process_invoice(i,'pay',request2);
 if r->>'status'<>'paid_simulated' then raise exception 'FAIL payment: %',r; end if;
 if (select balance from public.wallets where id=wallet)<>4200 or (select reserved from public.wallets where id=wallet)<>0
 or (select spent from public.budgets where id=budget)<>800 or (select reserved from public.budgets where id=budget)<>0 then raise exception 'FAIL payment balances'; end if;
 replay:=public.payguard_process_invoice(i,'pay',request2);
 if replay<>r or (select count(*) from public.wallet_movements where invoice_id=i and kind='payment_simulated')<>1 then raise exception 'FAIL payment idempotency'; end if;
 begin
  perform public.payguard_process_invoice(i,'pay',gen_random_uuid());
  raise exception 'FAIL second payment accepted';
 exception when raise_exception then if sqlerrm='FAIL second payment accepted' then raise; end if; end;
 begin
  update public.invoices set amount=799 where id=i;
  raise exception 'FAIL paid invoice edited';
 exception when raise_exception then if sqlerrm='FAIL paid invoice edited' then raise; end if; end;

 i:=payguard_private.test_invoice(c,admin_user,supplier,500);
 perform public.payguard_process_invoice(i,'evaluate',gen_random_uuid());
 r:=public.payguard_process_invoice(i,'cancel',gen_random_uuid());
 if r->>'status'<>'cancelled' or (select reserved from public.wallets where id=wallet)<>0 or (select reserved from public.budgets where id=budget)<>0 then raise exception 'FAIL cancellation release'; end if;
 begin
  perform public.payguard_process_invoice(i,'evaluate',gen_random_uuid());
  raise exception 'FAIL cancelled invoice processed';
 exception when raise_exception then if sqlerrm='FAIL cancelled invoice processed' then raise; end if; end;

 i:=payguard_private.test_invoice(c,admin_user,supplier,1500);
 r:=public.payguard_process_invoice(i,'evaluate',gen_random_uuid()); decision:=(r->>'decision_id')::uuid;
 if r->>'status'<>'pending_approval' or (select reserved from public.wallets where id=wallet)<>0 then raise exception 'FAIL approval threshold'; end if;
 perform set_config('request.jwt.claim.sub',operator_user::text,true);
 begin
  perform public.payguard_process_invoice(i,'approve',gen_random_uuid(),decision,'Prueba');
  raise exception 'FAIL operator approval permitted';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',admin_user::text,true);
 r:=public.payguard_process_invoice(i,'approve',gen_random_uuid(),decision,'Servicio ficticio revisado');
 if r->>'status'<>'authorized' or (select reserved from public.wallets where id=wallet)<>1500 then raise exception 'FAIL approved reservation: %',r; end if;
 r:=public.payguard_process_invoice(i,'pay',gen_random_uuid());
 if r->>'status'<>'paid_simulated' or (select balance from public.wallets where id=wallet)<>2700 or (select spent from public.budgets where id=budget)<>2300 then raise exception 'FAIL approved payment'; end if;

 i:=payguard_private.test_invoice(c,admin_user,supplier,2000);
 r:=public.payguard_process_invoice(i,'evaluate',gen_random_uuid());
 if r->>'status'<>'blocked' or not exists(select 1 from jsonb_array_elements(r->'checks') e where e->>'code'='BUDGET' and e->>'outcome'='block') then raise exception 'FAIL fresh budget check'; end if;
 i:=payguard_private.test_invoice(c,admin_user,supplier,3000);
 r:=public.payguard_process_invoice(i,'evaluate',gen_random_uuid());
 if r->>'status'<>'blocked' or not exists(select 1 from jsonb_array_elements(r->'checks') e where e->>'code'='FUNDS' and e->>'outcome'='block') then raise exception 'FAIL fresh funds check'; end if;
 i:=payguard_private.test_invoice(c,admin_user,supplier,3000.01);
 r:=public.payguard_process_invoice(i,'evaluate',gen_random_uuid());
 if r->>'status'<>'blocked' then raise exception 'FAIL absolute limit'; end if;
 i:=payguard_private.test_invoice(c,admin_user,supplier,800);
 update public.invoices set amount=801 where id=i;
 r:=public.payguard_process_invoice(i,'evaluate',gen_random_uuid());
 if r->>'status'<>'blocked' then raise exception 'FAIL agreement mismatch'; end if;
 i:=payguard_private.test_invoice(c,admin_user,supplier,100);
 update public.invoices set review_reasons='["Moneda ambigua en el documento"]' where id=i;
 r:=public.payguard_process_invoice(i,'evaluate',gen_random_uuid());
 if r->>'status'<>'needs_review' then raise exception 'FAIL unresolved extraction'; end if;
 i:=payguard_private.test_invoice(c,admin_user,supplier,100);
 update public.invoices set due_date=null where id=i;
 r:=public.payguard_process_invoice(i,'evaluate',gen_random_uuid());
 if r->>'status'<>'needs_review' then raise exception 'FAIL missing date'; end if;

 i:=payguard_private.test_invoice(c,admin_user,supplier,1200);
 r:=public.payguard_process_invoice(i,'evaluate',gen_random_uuid()); decision:=(r->>'decision_id')::uuid;
 select version into v from public.invoices where id=i;
 update public.invoices set due_date=current_date+11 where id=i;
 if (select version from public.invoices where id=i)<>v+1 then raise exception 'FAIL version increment'; end if;
 begin
  perform public.payguard_process_invoice(i,'approve',gen_random_uuid(),decision,'Documento cambiado');
  raise exception 'FAIL stale invoice approval';
 exception when raise_exception then if sqlerrm='FAIL stale invoice approval' then raise; end if; end;

 i:=payguard_private.test_invoice(c,admin_user,supplier,1200);
 r:=public.payguard_process_invoice(i,'evaluate',gen_random_uuid()); decision:=(r->>'decision_id')::uuid;
 update public.policies set active=false where id=policy;
 insert into public.policies(company_id,currency,version,automatic_limit,absolute_limit) values(c,'USD',2,1000,3000);
 begin
  perform public.payguard_process_invoice(i,'approve',gen_random_uuid(),decision,'Politica cambiada');
  raise exception 'FAIL stale policy approval';
 exception when raise_exception then if sqlerrm='FAIL stale policy approval' then raise; end if; end;
 r:=public.payguard_process_invoice(i,'evaluate',gen_random_uuid()); decision:=(r->>'decision_id')::uuid;
 r:=public.payguard_process_invoice(i,'reject',gen_random_uuid(),decision,'No corresponde autorizar');
 if r->>'status'<>'cancelled' then raise exception 'FAIL human rejection'; end if;

 -- Isolated competition for insufficient aggregate funds: first reserves 700, second must stop.
 insert into public.wallets(company_id,currency,balance) values(c2,'USD',1000);
 insert into public.budgets(company_id,currency,period,total) values(c2,'USD',date_trunc('month',transaction_timestamp() at time zone 'America/Bogota')::date,1000);
 insert into public.policies(company_id,currency,version,automatic_limit,absolute_limit) values(c2,'USD',1,1000,3000);
 i:=payguard_private.test_invoice(c2,outsider,supplier2,700);
 j:=payguard_private.test_invoice(c2,outsider,supplier2,700);
 begin
  perform public.payguard_process_invoice(i,'evaluate',gen_random_uuid());
  raise exception 'FAIL cross-company access';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 r:=public.payguard_process_invoice(i,'evaluate',gen_random_uuid());
 if r->>'status'<>'authorized' then raise exception 'FAIL competing first'; end if;
 r:=public.payguard_process_invoice(j,'evaluate',gen_random_uuid());
 if r->>'status'<>'blocked' or (select reserved from public.wallets where company_id=c2)<>700 then raise exception 'FAIL competing budget/funds'; end if;
 perform set_config('payguard.test_invoice',j::text,true);
 perform set_config('request.jwt.claim.sub','',true);
 begin
  perform public.payguard_process_invoice(j,'evaluate',gen_random_uuid());
  raise exception 'FAIL unauthenticated access';
 exception when insufficient_privilege then null; end;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
end $$;

set local role authenticated;
-- Verify invocation as the real caller role, not just migration owner.
select public.payguard_process_invoice(current_setting('payguard.test_invoice')::uuid,'evaluate',gen_random_uuid())->>'status' as resultado_bloqueado_esperado;
reset role;
set local role service_role;
do $$
begin
 begin
  update public.wallets set balance=999999;
  raise exception 'FAIL direct service-role mutation';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$
begin
 begin
  perform public.payguard_process_invoice(gen_random_uuid(),'evaluate',gen_random_uuid());
  raise exception 'FAIL anonymous RPC allowed';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select 'OK: escenarios transaccionales y permisos; fixtures revertidos.' as resultado;
rollback;
