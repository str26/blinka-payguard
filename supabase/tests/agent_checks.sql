-- Disposable database only. Verifies autonomy using the real authenticated caller role.
begin;
insert into auth.users(id) values('a7100000-0000-4000-8000-000000000001'),('a7100000-0000-4000-8000-000000000002'),('a7100000-0000-4000-8000-000000000003'),('a7100000-0000-4000-8000-000000000004');
insert into public.companies(id,name,agent_enabled) values('a7000000-0000-4000-8000-000000000001','Agent Demo',true);
insert into public.company_members(company_id,user_id,role) values
 ('a7000000-0000-4000-8000-000000000001','a7100000-0000-4000-8000-000000000001','admin'),
 ('a7000000-0000-4000-8000-000000000001','a7100000-0000-4000-8000-000000000002','operator'),
 ('a7000000-0000-4000-8000-000000000001','a7100000-0000-4000-8000-000000000003','approver');
insert into public.suppliers(id,company_id,code,name,allowed) values
 ('a7200000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','AGENT','Agent Supplier',true),
 ('a7200000-0000-4000-8000-000000000002','a7000000-0000-4000-8000-000000000001','DENIED','Denied Supplier',false);
insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description) values
 ('a7300000-0000-4000-8000-000000000001','a7000000-0000-4000-8000-000000000001','a7200000-0000-4000-8000-000000000001','AUTO','USD',800,'Automatic'),
 ('a7300000-0000-4000-8000-000000000002','a7000000-0000-4000-8000-000000000001','a7200000-0000-4000-8000-000000000001','APPROVAL','USD',1500,'Human approval'),
 ('a7300000-0000-4000-8000-000000000003','a7000000-0000-4000-8000-000000000001','a7200000-0000-4000-8000-000000000001','LIMIT','USD',3500,'Absolute limit'),
 ('a7300000-0000-4000-8000-000000000004','a7000000-0000-4000-8000-000000000001','a7200000-0000-4000-8000-000000000002','DENIED','USD',800,'Denied supplier');
insert into public.wallets(company_id,currency,balance) values('a7000000-0000-4000-8000-000000000001','USD',10000);
insert into public.budgets(company_id,currency,period,total) values('a7000000-0000-4000-8000-000000000001','USD',date_trunc('month',now() at time zone 'America/Bogota')::date,10000);
insert into public.policies(company_id,currency,version,automatic_limit,absolute_limit) values('a7000000-0000-4000-8000-000000000001','USD',1,1000,3000);
insert into public.documents(id,company_id,uploaded_by,original_name,storage_path,mime_type,byte_size,sha256)
select ('a7400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'a7000000-0000-4000-8000-000000000001','a7100000-0000-4000-8000-000000000002','agent.pdf','a7000000-0000-4000-8000-000000000001/'||n,'application/pdf',100,lpad(n::text,64,'0') from generate_series(1,12) n;
insert into public.invoices(id,company_id,document_id,status,extraction_state,review_reasons,extracted_data)
select ('a7500000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'a7000000-0000-4000-8000-000000000001',('a7400000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'needs_review','completed','["Pending human review"]',
 jsonb_build_object('fields',jsonb_build_object(
 'invoice_number',jsonb_build_object('value','AGENT-'||n,'evidence','Invoice AGENT-'||n),
 'supplier_code',jsonb_build_object('value','AGENT','evidence','Supplier AGENT'),
 'supplier_name',jsonb_build_object('value','Agent Supplier','evidence','Agent Supplier'),
 'agreement_reference',jsonb_build_object('value',case when n in (2,11,12) then 'APPROVAL' when n=7 then 'LIMIT' when n=8 then 'DENIED' else 'AUTO' end,'evidence','Agreement reference'),
 'amount',jsonb_build_object('value',case when n in (2,11,12) then '1500.00' when n=3 then '900.00' when n=7 then '3500.00' else '800.00' end,'evidence','Total USD'),
 'currency',jsonb_build_object('value','USD','evidence','USD'),
 'issue_date',jsonb_build_object('value','2026-10-17','evidence','2026-10-17'),
 'due_date',jsonb_build_object('value','2026-10-20','evidence','2026-10-20')),
 'warnings',jsonb_build_array('DEMO_DOCUMENT: Documento ficticio para simulación.'))
from generate_series(1,12) n;
update public.invoices set extracted_data=jsonb_set(extracted_data,'{fields,due_date,value}','null') where id='a7500000-0000-4000-8000-000000000004';
update public.invoices set extracted_data=jsonb_set(extracted_data,'{warnings}','["Dos importes posibles: requiere revisión."]') where id='a7500000-0000-4000-8000-000000000005';
update public.invoices set extracted_data=jsonb_set(extracted_data,'{fields,invoice_number,value}','"AGENT-1"') where id='a7500000-0000-4000-8000-000000000006';
update public.invoices set extracted_data=jsonb_set(jsonb_set(extracted_data,'{fields,supplier_code,value}','"DENIED"'),'{fields,supplier_name,value}','"Denied Supplier"') where id='a7500000-0000-4000-8000-000000000008';
update public.invoices set extracted_data=jsonb_set(extracted_data,'{fields,supplier_name,value}','"Wrong name"') where id='a7500000-0000-4000-8000-000000000009';
select set_config('request.jwt.claim.sub','a7100000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
declare r jsonb;again jsonb;request uuid:=gen_random_uuid();i uuid;v integer;company uuid:='a7000000-0000-4000-8000-000000000001';
begin
 if has_function_privilege('authenticated','payguard_private.process_invoice_internal(uuid,text,uuid,uuid,text,uuid,boolean)','EXECUTE') then raise exception 'Caller can forge machine capability';end if;
 r:=public.payguard_run_agent('a7500000-0000-4000-8000-000000000001',request);
 if r->>'status'<>'paid_simulated' or r->'agent'->>'state'<>'paid' then raise exception 'Complete invoice not paid autonomously: %',r;end if;
 again:=public.payguard_run_agent('a7500000-0000-4000-8000-000000000001',request);
 if again<>r then raise exception 'Agent replay differs';end if;
 perform public.payguard_run_agent('a7500000-0000-4000-8000-000000000001',gen_random_uuid());
 if (select count(*) from public.wallet_movements where invoice_id='a7500000-0000-4000-8000-000000000001' and kind='payment_simulated')<>1 then raise exception 'Agent paid twice';end if;
 if exists(select 1 from public.invoice_reviews where invoice_id='a7500000-0000-4000-8000-000000000001') then raise exception 'Automatic path required human review';end if;
 r:=public.payguard_run_agent('a7500000-0000-4000-8000-000000000002',gen_random_uuid());
 if r->>'status'<>'pending_approval' then raise exception 'Approval threshold skipped';end if;
 -- Regression: correcting fields is not approval. Repeated confirmations must never pay;
 -- approval of the latest decision must still complete exactly one payment.
 for attempt in 1..2 loop
  select version into v from public.invoices where id='a7500000-0000-4000-8000-000000000002';
  r:=public.payguard_confirm_invoice('a7500000-0000-4000-8000-000000000002',gen_random_uuid(),v,'a7200000-0000-4000-8000-000000000001','a7300000-0000-4000-8000-000000000002','AGENT-2','USD','1500.00','2026-10-17','2026-10-20',true);
  if r->>'status'<>'pending_approval' then raise exception 'Field confirmation incorrectly approved spending: %',r;end if;
 end loop;
 if exists(select 1 from public.approvals where invoice_id='a7500000-0000-4000-8000-000000000002') or exists(select 1 from public.wallet_movements where invoice_id='a7500000-0000-4000-8000-000000000002') then raise exception 'Correction bypassed approval';end if;
 perform set_config('test.agent_decision',r->>'decision_id',true);
 if (select reserved from public.wallets where company_id=company)<>0 then raise exception 'Pending approval reserved funds';end if;
 r:=public.payguard_run_agent('a7500000-0000-4000-8000-000000000003',gen_random_uuid());
 if r->>'status'<>'blocked' or r->'agent'->>'state'<>'review' then raise exception 'Agreement discrepancy not routed to human review';end if;
 foreach i in array array['a7500000-0000-4000-8000-000000000004'::uuid,'a7500000-0000-4000-8000-000000000005'::uuid,'a7500000-0000-4000-8000-000000000006'::uuid,'a7500000-0000-4000-8000-000000000009'::uuid] loop
  r:=public.payguard_run_agent(i,gen_random_uuid());
  if r->>'status'<>'needs_review' then raise exception 'Ambiguous, missing or duplicate data paid: %',i;end if;
 end loop;
 foreach i in array array['a7500000-0000-4000-8000-000000000007'::uuid,'a7500000-0000-4000-8000-000000000008'::uuid] loop
  r:=public.payguard_run_agent(i,gen_random_uuid());if r->>'status'<>'blocked' then raise exception 'Absolute limit or denied supplier paid';end if;
 end loop;
 select version into v from public.invoices where id='a7500000-0000-4000-8000-000000000004';
 r:=public.payguard_confirm_invoice('a7500000-0000-4000-8000-000000000004',gen_random_uuid(),v,'a7200000-0000-4000-8000-000000000001','a7300000-0000-4000-8000-000000000001','AGENT-4','USD','800.00','2026-10-17','2026-10-20',true);
 if r->>'status'<>'paid_simulated' then raise exception 'Human correction did not continue to autonomous payment';end if;
 if (select extracted_data->'fields'->'due_date'->'value' from public.invoices where id='a7500000-0000-4000-8000-000000000004')<>'null'::jsonb then raise exception 'Original extraction overwritten';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','a7100000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$
declare r jsonb;again jsonb;request uuid:=gen_random_uuid();decision uuid:=current_setting('test.agent_decision')::uuid;
begin
 r:=public.payguard_process_invoice('a7500000-0000-4000-8000-000000000002','approve',request,decision,'Acuerdo revisado');
 if r->>'status'<>'paid_simulated' then raise exception 'Approval did not automatically pay';end if;
 again:=public.payguard_process_invoice('a7500000-0000-4000-8000-000000000002','approve',request,decision,'Acuerdo revisado');
 if again<>r then raise exception 'Approval replay changed agent result';end if;
 begin perform public.payguard_process_invoice('a7500000-0000-4000-8000-000000000002','approve',request,decision,'Another reason');raise exception 'Changed approval replay accepted';exception when invalid_parameter_value then null;end;
 if (select balance from public.wallets where company_id='a7000000-0000-4000-8000-000000000001')<>6900 then raise exception 'Autonomous accounting mismatch';end if;
 if (select reserved from public.wallets where company_id='a7000000-0000-4000-8000-000000000001')<>0 then raise exception 'Consumed reserves remain active';end if;
end $$;
reset role;
-- Regression: sufficient budget cannot compensate for insufficient wallet funds.
update public.wallets set balance=1300 where company_id='a7000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','a7100000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.payguard_run_agent('a7500000-0000-4000-8000-000000000011',gen_random_uuid());
 if r->>'status'<>'blocked' or not exists(select 1 from jsonb_array_elements(r->'checks') c where c->>'code'='FUNDS' and c->>'outcome'='block' and c->>'message'='Fondos insuficientes. Requerido: USD 1500.00. Disponible: USD 1300.00. Faltante: USD 200.00. No se ejecutó el pago.') then raise exception 'Missing exact insufficient funds explanation: %',r;end if;
 if not (r->'agent'->'reasons' @> '["Fondos insuficientes. Requerido: USD 1500.00. Disponible: USD 1300.00. Faltante: USD 200.00. No se ejecutó el pago."]'::jsonb) then raise exception 'Agent trace lost funds error';end if;
 if exists(select 1 from public.wallet_movements where invoice_id='a7500000-0000-4000-8000-000000000011') or exists(select 1 from public.reservations where invoice_id='a7500000-0000-4000-8000-000000000011') then raise exception 'Insufficient funds created financial effects';end if;
 if (select balance from public.wallets where company_id='a7000000-0000-4000-8000-000000000001')<>1300 then raise exception 'Blocked invoice debited wallet';end if;
end $$;
reset role;
update public.wallets set balance=6900 where company_id='a7000000-0000-4000-8000-000000000001';
update public.budgets set total=spent+1300 where company_id='a7000000-0000-4000-8000-000000000001';
set local role authenticated;
do $$ declare r jsonb; begin
 r:=public.payguard_run_agent('a7500000-0000-4000-8000-000000000012',gen_random_uuid());
 if r->>'status'<>'blocked' or not exists(select 1 from jsonb_array_elements(r->'checks') c where c->>'code'='BUDGET' and c->>'outcome'='block' and c->>'message' like 'Presupuesto insuficiente.%USD 200.00.%') then raise exception 'Budget shortage not explained: %',r;end if;
 if exists(select 1 from public.wallet_movements where invoice_id='a7500000-0000-4000-8000-000000000012') then raise exception 'Insufficient budget paid';end if;
end $$;
reset role;
update public.budgets set total=10000 where company_id='a7000000-0000-4000-8000-000000000001';
update public.companies set agent_enabled=false where id='a7000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','a7100000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare r jsonb;begin
 r:=public.payguard_run_agent('a7500000-0000-4000-8000-000000000010',gen_random_uuid());
 if r->'agent'->>'state'<>'disabled' or (select balance from public.wallets where company_id='a7000000-0000-4000-8000-000000000001')<>6900 then raise exception 'Disabled agent paid';end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','a7100000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.agent_runs where company_id='a7000000-0000-4000-8000-000000000001') then raise exception 'Agent trace leaked across tenants';end if;
 begin perform public.payguard_run_agent('a7500000-0000-4000-8000-000000000010',gen_random_uuid());raise exception 'Outsider ran agent';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role service_role;
do $$ begin
 begin perform public.payguard_run_agent(gen_random_uuid(),gen_random_uuid());raise exception 'Secret key invoked financial agent without user';exception when insufficient_privilege then null;end;
end $$;
reset role;
rollback;
