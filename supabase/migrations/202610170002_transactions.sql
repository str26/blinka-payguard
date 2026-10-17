begin;

alter table public.decisions add column decision_order bigint generated always as identity;
create index decisions_latest_order_idx on public.decisions(company_id,invoice_id,decision_order desc);

alter table public.invoices add column review_reasons jsonb not null default '[]'::jsonb check(jsonb_typeof(review_reasons)='array');

create table public.operation_requests (
 company_id uuid not null references public.companies(id), request_id uuid not null,
 invoice_id uuid not null, actor_id uuid not null,
 input jsonb not null, response jsonb not null, created_at timestamptz not null default now(),
 primary key(company_id,request_id),
 foreign key(invoice_id,company_id) references public.invoices(id,company_id),
 foreign key(company_id,actor_id) references public.company_members(company_id,user_id)
);
alter table public.operation_requests enable row level security;
revoke all on public.operation_requests from public,anon,authenticated,service_role;
grant select on public.operation_requests to authenticated,service_role;
create policy operation_requests_read on public.operation_requests for select to authenticated
 using(payguard_private.is_member(company_id));

-- An approved document cannot change silently. Corrections invalidate old approvals via version.
create function payguard_private.version_invoice() returns trigger
language plpgsql set search_path='' as $$
begin
 if new.company_id<>old.company_id then raise exception 'Invoice company is immutable'; end if;
 if (new.document_id,new.supplier_id,new.agreement_id,new.invoice_number,new.currency,new.amount,new.issue_date,new.due_date,new.extracted_data,new.review_reasons)
  is distinct from
 (old.document_id,old.supplier_id,old.agreement_id,old.invoice_number,old.currency,old.amount,old.issue_date,old.due_date,old.extracted_data,old.review_reasons) then
  if old.status in ('authorized','paid_simulated') or exists(select 1 from public.reservations r where r.invoice_id=old.id and r.status in ('active','consumed')) then
   raise exception 'Cancel the authorization before editing; paid invoices cannot be edited';
  end if;
  new.version:=old.version+1;
 elsif new.version<>old.version then
  raise exception 'Invoice version is managed by the database';
 end if;
 return new;
end $$;
create trigger invoices_version before update on public.invoices for each row execute function payguard_private.version_invoice();

create function payguard_private.version_policy() returns trigger
language plpgsql set search_path='' as $$
begin
 if (new.company_id,new.currency,new.version,new.automatic_limit,new.absolute_limit) is distinct from
 (old.company_id,old.currency,old.version,old.automatic_limit,old.absolute_limit) then
  raise exception 'Create a new policy version instead of overwriting policy terms';
 end if;
 return new;
end $$;
create trigger policies_version before update on public.policies for each row execute function payguard_private.version_policy();

create function payguard_private.check_item(code text,outcome text,message text) returns jsonb
language sql immutable set search_path='' as $$
 select jsonb_build_array(jsonb_build_object('code',code,'outcome',outcome,'message',message));
$$;

create function payguard_private.release_invoice_reservation(target uuid) returns void
language plpgsql set search_path='' as $$
declare r public.reservations%rowtype;
begin
 for r in select * from public.reservations where invoice_id=target and status='active' for update loop
  update public.wallets set reserved=reserved-r.amount where id=r.wallet_id;
  update public.budgets set reserved=reserved-r.amount where id=r.budget_id;
  update public.reservations set status='released' where id=r.id;
 end loop;
end $$;

create function payguard_private.process_invoice(
 p_invoice uuid,p_action text,p_request uuid,p_decision uuid default null,p_reason text default null
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); company uuid; member_role text;
 inv public.invoices%rowtype; pol public.policies%rowtype; wal public.wallets%rowtype; bud public.budgets%rowtype;
 agr public.agreements%rowtype; previous public.decisions%rowtype; req public.operation_requests%rowtype;
 res public.reservations%rowtype; own public.reservations%rowtype;
 checks jsonb:='[]'::jsonb; snapshot jsonb; result jsonb; request_input jsonb;
 status_result text; decision_id uuid; reservation_id uuid; movement_id uuid;
 has_approval boolean:=false; allow_supplier boolean; fields_ok boolean; month_start date;
 funds numeric; budget_available numeric; own_wallet numeric:=0; own_budget numeric:=0;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_request is null or p_action is null or p_action not in ('evaluate','approve','reject','cancel','pay') then
  raise exception 'Invalid action or request ID';
 end if;
 if p_action in ('approve','reject') and (p_decision is null or p_reason is null or length(trim(p_reason))=0 or length(p_reason)>1000) then
  raise exception 'Decision ID and reason (1-1000 characters) required';
 end if;
 if p_action not in ('approve','reject') and (p_decision is not null or p_reason is not null) then
  raise exception 'Unexpected approval parameters';
 end if;
 select company_id into company from public.invoices where id=p_invoice;
 if company is null then raise exception 'Invoice unavailable' using errcode='42501'; end if;
 select role into member_role from public.company_members where company_id=company and user_id=actor for share;
 if member_role is null then raise exception 'Invoice unavailable' using errcode='42501'; end if;
 if p_action<>'evaluate' and member_role not in ('admin','approver') then
  raise exception 'Approver role required' using errcode='42501';
 end if;
 -- Coarse lock deliberately serializes financial commands per company for this MVP.
 perform pg_advisory_xact_lock(hashtextextended(company::text,0));
 select * into inv from public.invoices where id=p_invoice and company_id=company for update;
 request_input:=jsonb_build_object('action',p_action,'invoice_id',p_invoice,'decision_id',p_decision,'reason',p_reason);
 select * into req from public.operation_requests where company_id=company and request_id=p_request;
 if found then
  if req.actor_id<>actor or req.input<>request_input then raise exception 'Idempotency key already used for a different command'; end if;
  return req.response;
 end if;
 if inv.status='paid_simulated' then raise exception 'Invoice already paid; use the original request ID to retry'; end if;
 if inv.status='cancelled' then raise exception 'Cancelled invoice cannot be processed'; end if;

 if p_action in ('approve','reject') then
  select * into previous from public.decisions where id=p_decision and invoice_id=inv.id and company_id=company;
  if not found or previous.status<>'pending_approval' or previous.invoice_version<>inv.version or inv.status<>'pending_approval'
    or exists(select 1 from public.approvals existing_approval where existing_approval.decision_id=p_decision)
    or previous.id is distinct from (select d.id from public.decisions d where d.invoice_id=inv.id order by d.decision_order desc limit 1) then
   raise exception 'Approval is stale, resolved or invalid';
  end if;
 end if;
 if p_action in ('reject','cancel') then
  perform payguard_private.release_invoice_reservation(inv.id);
  if p_action='reject' then
   insert into public.approvals(company_id,invoice_id,decision_id,actor_id,action,reason)
   values(company,inv.id,p_decision,actor,'reject',trim(p_reason));
   status_result:='cancelled';
  else status_result:='cancelled'; end if;
  update public.invoices set status=status_result where id=inv.id;
  result:=jsonb_build_object('invoice_id',inv.id,'status',status_result,'simulation',true);
 else
  if p_action='pay' and inv.status<>'authorized' then raise exception 'Only an authorized invoice can simulate payment'; end if;
  month_start:=date_trunc('month',transaction_timestamp() at time zone 'America/Bogota')::date;
  select * into pol from public.policies where company_id=company and currency=inv.currency and active for share;
  select * into wal from public.wallets where company_id=company and currency=inv.currency for update;
  select * into bud from public.budgets where company_id=company and currency=inv.currency and period=month_start for update;
  select * into own from public.reservations where invoice_id=inv.id and company_id=company and status='active' for update;
  if own.id is not null then
   if own.wallet_id=wal.id then own_wallet:=own.amount; end if;
   if own.budget_id=bud.id then own_budget:=own.amount; end if;
  end if;
  funds:=coalesce(wal.available,0)+own_wallet;
  budget_available:=coalesce(bud.available,0)+own_budget;
  checks:=checks||payguard_private.check_item('REVIEW_REASONS',case when jsonb_array_length(inv.review_reasons)>0 then 'review' else 'pass' end,'No hay ambiguedades o validaciones pendientes registradas por el backend.');
  fields_ok:=inv.supplier_id is not null and inv.invoice_number is not null and inv.currency is not null and inv.amount is not null and inv.due_date is not null;
  checks:=checks||payguard_private.check_item('FIELDS',case when fields_ok then 'pass' else 'review' end,'Campos obligatorios y vencimiento valido.');
  select allowed into allow_supplier from public.suppliers where id=inv.supplier_id and company_id=company for share;
  checks:=checks||payguard_private.check_item('SUPPLIER',case when inv.supplier_id is null then 'review' when coalesce(allow_supplier,false) then 'pass' else 'block' end,'Beneficiario permitido por la empresa.');
  select * into agr from public.agreements where id=inv.agreement_id and company_id=company and supplier_id=inv.supplier_id and currency=inv.currency for share;
  checks:=checks||payguard_private.check_item('AGREEMENT',case when agr.id is null then 'review' when inv.amount=agr.amount then 'pass' else 'block' end,'Importe y moneda coinciden con el acuerdo registrado.');
  checks:=checks||payguard_private.check_item('POLICY',case when pol.id is null then 'review' else 'pass' end,'Politica activa para la moneda.');
  checks:=checks||payguard_private.check_item('WALLET',case when wal.id is null then 'review' else 'pass' end,'Wallet disponible para la moneda.');
  checks:=checks||payguard_private.check_item('PERIOD_BUDGET',case when bud.id is null then 'review' else 'pass' end,'Presupuesto del mes vigente en America/Bogota.');
  if fields_ok and pol.id is not null then
   checks:=checks||payguard_private.check_item('ABSOLUTE_LIMIT',case when inv.amount>pol.absolute_limit then 'block' else 'pass' end,'Respeta el limite absoluto por operacion.');
  end if;
  if fields_ok and wal.id is not null then
   checks:=checks||payguard_private.check_item('FUNDS',case when inv.amount>funds then 'block' else 'pass' end,'Fondos disponibles suficientes, excluida la reserva propia.');
  end if;
  if fields_ok and bud.id is not null then
   checks:=checks||payguard_private.check_item('BUDGET',case when inv.amount>budget_available then 'block' else 'pass' end,'Presupuesto disponible suficiente, excluida la reserva propia.');
  end if;
  if p_action='approve' then
   if previous.policy_id is distinct from pol.id then raise exception 'Policy changed; evaluate again before approval'; end if;
   has_approval:=true;
  else
   select exists(
    select 1 from public.approvals a join public.decisions d on d.id=a.decision_id
    join public.company_members m on m.company_id=a.company_id and m.user_id=a.actor_id
    where a.invoice_id=inv.id and a.company_id=company and a.action='approve'
     and d.invoice_version=inv.version and d.policy_id=pol.id and m.role in ('admin','approver')
   ) into has_approval;
  end if;
  if fields_ok and pol.id is not null then
   checks:=checks||payguard_private.check_item('APPROVAL_THRESHOLD',case when inv.amount>pol.automatic_limit and not has_approval then 'approval' else 'pass' end,'Umbral automatico o aprobacion humana vigente.');
  end if;
  status_result:=case
   when exists(select 1 from jsonb_array_elements(checks) c where c->>'outcome'='block') then 'blocked'
   when exists(select 1 from jsonb_array_elements(checks) c where c->>'outcome'='review') then 'needs_review'
   when exists(select 1 from jsonb_array_elements(checks) c where c->>'outcome'='approval') then 'pending_approval'
   else 'authorized' end;
  snapshot:=jsonb_build_object('invoice',to_jsonb(inv),'policy',case when pol.id is null then null else to_jsonb(pol) end,
   'agreement',case when agr.id is null then null else to_jsonb(agr) end,'available_funds',funds::text,'available_budget',budget_available::text,'budget_period',month_start,'actor',actor);
  insert into public.decisions(company_id,invoice_id,invoice_version,policy_id,currency,status,input_snapshot,checks,created_at)
  values(company,inv.id,inv.version,pol.id,inv.currency,status_result,snapshot,checks,clock_timestamp()) returning id into decision_id;
  if p_action='approve' and status_result='authorized' then
   insert into public.approvals(company_id,invoice_id,decision_id,actor_id,action,reason)
   values(company,inv.id,p_decision,actor,'approve',trim(p_reason));
  end if;
  -- Release earlier reservations only after all fresh checks were computed.
  perform payguard_private.release_invoice_reservation(inv.id);
  if status_result='authorized' then
   update public.wallets set reserved=reserved+inv.amount where id=wal.id;
   update public.budgets set reserved=reserved+inv.amount where id=bud.id;
   insert into public.reservations(company_id,invoice_id,decision_id,wallet_id,budget_id,currency,amount,idempotency_key)
   values(company,inv.id,decision_id,wal.id,bud.id,inv.currency,inv.amount,p_request) returning id into reservation_id;
   if p_action='pay' then
    update public.wallets set balance=balance-inv.amount,reserved=reserved-inv.amount where id=wal.id;
    update public.budgets set spent=spent+inv.amount,reserved=reserved-inv.amount where id=bud.id;
    update public.reservations set status='consumed' where id=reservation_id;
    insert into public.wallet_movements(company_id,wallet_id,currency,invoice_id,reservation_id,kind,amount,idempotency_key,description)
    values(company,wal.id,inv.currency,inv.id,reservation_id,'payment_simulated',inv.amount,p_request,'Pago simulado; sin movimiento de dinero real') returning id into movement_id;
    status_result:='paid_simulated';
   end if;
  end if;
  update public.invoices set status=status_result where id=inv.id;
  result:=jsonb_build_object('invoice_id',inv.id,'status',status_result,'decision_id',decision_id,'reservation_id',reservation_id,'movement_id',movement_id,'checks',checks,'simulation',true);
 end if;
 insert into public.audit_events(company_id,actor_id,event_type,entity_id,details)
 values(company,actor,'invoice.'||p_action,inv.id,result);
 insert into public.operation_requests(company_id,request_id,invoice_id,actor_id,input,response)
 values(company,p_request,inv.id,actor,request_input,result);
 return result;
end $$;

-- Exposed RPC is an invoker wrapper; privileged implementation stays outside exposed schemas.
create function public.payguard_process_invoice(
 p_invoice uuid,p_action text,p_request uuid,p_decision uuid default null,p_reason text default null
) returns jsonb language sql security invoker set search_path='' as $$
 select payguard_private.process_invoice(p_invoice,p_action,p_request,p_decision,p_reason);
$$;
revoke all on function payguard_private.version_invoice(),payguard_private.version_policy(),payguard_private.check_item(text,text,text),payguard_private.release_invoice_reservation(uuid),payguard_private.process_invoice(uuid,text,uuid,uuid,text) from public,anon,authenticated,service_role;
revoke all on function public.payguard_process_invoice(uuid,text,uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function payguard_private.process_invoice(uuid,text,uuid,uuid,text),public.payguard_process_invoice(uuid,text,uuid,uuid,text) to authenticated;
-- Financial mutations must use these operations. Server key alone cannot mutate balances.
revoke insert,update,delete,truncate on public.wallets,public.budgets,public.reservations,public.wallet_movements from service_role;
commit;
