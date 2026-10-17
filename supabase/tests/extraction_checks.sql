-- Regression checks for a disposable local database. Changes roll back.
begin;
insert into auth.users(id) values('90000000-0000-4000-8000-000000000001'),('90000000-0000-4000-8000-000000000002'),('90000000-0000-4000-8000-000000000003');
insert into public.company_members(company_id,user_id,role) values
 ('10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000001','admin'),
 ('10000000-0000-4000-8000-000000000001','90000000-0000-4000-8000-000000000002','approver');
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare a jsonb;b jsonb;c jsonb;invoice uuid;
begin
 if has_function_privilege('authenticated','public.payguard_finish_extraction(uuid,uuid,jsonb,text)','execute') then raise exception 'Client can forge extraction'; end if;
 a:=public.payguard_register_document('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000001','demo.pdf','application/pdf',100,repeat('a',64));
 invoice:=(a->>'id')::uuid;
 b:=public.payguard_register_document('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000002','copy.pdf','application/pdf',100,repeat('a',64));
 if b->>'id'<>a->>'id' or b->>'duplicate'<>'true' then raise exception 'Duplicate registered twice'; end if;
 c:=public.payguard_claim_extraction(invoice);
 if c->>'state'<>'claimed' then raise exception 'Lease not acquired'; end if;
 b:=public.payguard_claim_extraction(invoice);
 if b->>'state'<>'busy' then raise exception 'Concurrent attempt accepted'; end if;
 perform set_config('test.invoice',invoice::text,true);perform set_config('test.lease',c->>'lease',true);
end $$;
reset role;
set local role service_role;
do $$
declare invoice uuid:=current_setting('test.invoice')::uuid; lease uuid:=current_setting('test.lease')::uuid;
begin
 if public.payguard_finish_extraction(invoice,gen_random_uuid(),'{"fields":{}}',null) then raise exception 'Wrong lease accepted'; end if;
 if not public.payguard_finish_extraction(invoice,lease,'{"fields":{},"warnings":[]}',null) then raise exception 'Valid completion rejected'; end if;
 if public.payguard_finish_extraction(invoice,lease,'{"fields":{}}',null) then raise exception 'Replayed completion accepted'; end if;
end $$;
reset role;
set local role authenticated;
do $$
declare c jsonb;
begin
 c:=public.payguard_claim_extraction(current_setting('test.invoice')::uuid);
 if c->>'state'<>'completed' then raise exception 'Completed invoice sent to model twice'; end if;
 if exists(select 1 from public.invoices where id=current_setting('test.invoice')::uuid and (amount is not null or currency is not null or status<>'needs_review')) then raise exception 'Extraction set payable fields'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
 begin perform public.payguard_claim_extraction(current_setting('test.invoice')::uuid); raise exception 'Approver unexpectedly extracted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.invoices where id=current_setting('test.invoice')::uuid) then raise exception 'RLS leaked invoice'; end if;
 begin perform public.payguard_claim_extraction(current_setting('test.invoice')::uuid); raise exception 'Nonmember unexpectedly extracted'; exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ begin
 if exists(select 1 from public.wallets where reserved<>0) or exists(select 1 from public.budgets where reserved<>0 or spent<>0) or exists(select 1 from public.wallet_movements where kind='payment_simulated') then raise exception 'Extraction changed financial balances'; end if;
end $$;
select set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
do $$
declare registration jsonb; claim jsonb; invoice uuid; old_lease uuid;
begin
 registration:=public.payguard_register_document('10000000-0000-4000-8000-000000000001','91000000-0000-4000-8000-000000000003','retry.pdf','application/pdf',100,repeat('b',64));
 invoice:=(registration->>'id')::uuid;
 claim:=public.payguard_claim_extraction(invoice);old_lease:=(claim->>'lease')::uuid;
 update public.invoices set extraction_started_at=now()-interval '4 minutes' where id=invoice;
 claim:=public.payguard_claim_extraction(invoice);
 if claim->>'state'<>'claimed' or (claim->>'lease')::uuid=old_lease then raise exception 'Expired attempt cannot recover'; end if;
 if public.payguard_finish_extraction(invoice,old_lease,'{"fields":{}}',null) then raise exception 'Expired lease overwrote new attempt'; end if;
 perform public.payguard_finish_extraction(invoice,(claim->>'lease')::uuid,null,'QUOTA');
 claim:=public.payguard_claim_extraction(invoice);
 perform public.payguard_finish_extraction(invoice,(claim->>'lease')::uuid,null,'TIMEOUT');
 claim:=public.payguard_claim_extraction(invoice);
 if claim->>'state'<>'limit' then raise exception 'Attempt limit was bypassed'; end if;
end $$;
rollback;
