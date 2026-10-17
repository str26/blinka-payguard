begin;

-- A request records the reviewed payload as well as the resulting financial decision.
create table public.invoice_reviews (
 company_id uuid not null references public.companies(id), request_id uuid not null,
 invoice_id uuid not null, actor_id uuid not null, input jsonb not null, response jsonb not null,
 created_at timestamptz not null default now(),
 primary key(company_id,request_id),
 foreign key(invoice_id,company_id) references public.invoices(id,company_id),
 foreign key(company_id,actor_id) references public.company_members(company_id,user_id)
);
alter table public.invoice_reviews enable row level security;
revoke all on public.invoice_reviews from public,anon,authenticated,service_role;
grant select on public.invoice_reviews to authenticated,service_role;
create policy invoice_reviews_read on public.invoice_reviews for select to authenticated using(payguard_private.is_member(company_id));

create function public.payguard_confirm_invoice(
 p_invoice uuid,p_request uuid,p_version integer,p_supplier uuid,p_agreement uuid,
 p_number text,p_currency text,p_amount text,p_issue date,p_due date,p_acknowledged boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); company uuid; member_role text; inv public.invoices%rowtype;
 previous public.invoice_reviews%rowtype; payload jsonb; answer jsonb; amount_value numeric;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select company_id into company from public.invoices where id=p_invoice;
 select role into member_role from public.company_members where company_id=company and user_id=actor for share;
 if member_role is null or member_role not in ('admin','operator') then raise exception 'Review access denied' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(company::text,0));
 select * into inv from public.invoices where id=p_invoice for update;
 if p_request is null or p_version is null or p_version<1 or p_acknowledged is distinct from true then raise exception 'Review acknowledgement and version required' using errcode='22023'; end if;
 if p_number is null or length(btrim(p_number))=0 or length(p_number)>100 or p_number ~ '[[:cntrl:]]'
   or p_currency is null or p_currency not in ('USD','COP','MXN') or p_amount is null
   or p_amount !~ '^(0|[1-9][0-9]{0,17})(\.[0-9]{1,2})?$'
   or p_issue is null or p_due is null or p_issue<date '1900-01-01' or p_due<date '1900-01-01'
   or p_issue>date '9999-12-31' or p_due>date '9999-12-31' or p_due<p_issue then
  raise exception 'Invalid invoice fields' using errcode='22023';
 end if;
 amount_value:=p_amount::numeric;
 if amount_value<=0 then raise exception 'Amount must be positive' using errcode='22023'; end if;
 payload:=jsonb_build_object('version',p_version,'supplier',p_supplier,'agreement',p_agreement,'number',btrim(p_number),
  'currency',p_currency,'amount',amount_value::text,'issue',p_issue,'due',p_due,'acknowledged',p_acknowledged);
 select * into previous from public.invoice_reviews where company_id=company and request_id=p_request;
 if found then
  if previous.actor_id<>actor or previous.invoice_id<>p_invoice or previous.input<>payload then
   raise exception 'Review request already used' using errcode='22023';
  end if;
  return previous.response;
 end if;
 if exists(select 1 from public.operation_requests where company_id=company and request_id=p_request) then
  raise exception 'Request already used for another operation' using errcode='22023';
 end if;
 if inv.version<>p_version then raise exception 'Invoice changed; reload before confirming' using errcode='40001'; end if;
 if inv.status in ('authorized','paid_simulated','cancelled') or exists(select 1 from public.reservations where invoice_id=p_invoice and status in ('active','consumed')) then
  raise exception 'Invoice can no longer be edited' using errcode='55000';
 end if;
 if inv.extraction_state<>'completed' then raise exception 'Complete extraction before review' using errcode='55000'; end if;
 if not exists(select 1 from public.suppliers where id=p_supplier and company_id=company) then
  raise exception 'Supplier unavailable' using errcode='22023';
 end if;
 if p_agreement is not null and not exists(select 1 from public.agreements where id=p_agreement and company_id=company and supplier_id=p_supplier and currency=p_currency) then
  raise exception 'Agreement does not match supplier and currency' using errcode='22023';
 end if;
 if exists(select 1 from public.invoices other where other.company_id=company and other.supplier_id=p_supplier and other.normalized_number=lower(btrim(p_number)) and other.id<>p_invoice) then
  raise exception 'Duplicate supplier invoice number' using errcode='23505';
 end if;
 update public.invoices set supplier_id=p_supplier,agreement_id=p_agreement,invoice_number=btrim(p_number),currency=p_currency,
  amount=amount_value,issue_date=p_issue,due_date=p_due,review_reasons='[]'::jsonb,status='needs_review'
 where id=p_invoice;
 -- Keep the original extraction immutable. Save who accepted/corrected it and what was confirmed.
 insert into public.audit_events(company_id,actor_id,event_type,entity_id,details)
 values(company,actor,'invoice_reviewed',p_invoice,jsonb_build_object('before',to_jsonb(inv),'confirmed',payload));
 -- Existing SQL authority evaluates AND reserves funds in this same transaction.
 answer:=payguard_private.process_invoice(p_invoice,'evaluate',p_request,null,null);
 insert into public.invoice_reviews(company_id,request_id,invoice_id,actor_id,input,response)
 values(company,p_request,p_invoice,actor,payload,answer);
 return answer;
end $$;
revoke all on function public.payguard_confirm_invoice(uuid,uuid,integer,uuid,uuid,text,text,text,date,date,boolean) from public,anon,authenticated,service_role;
grant execute on function public.payguard_confirm_invoice(uuid,uuid,integer,uuid,uuid,text,text,text,date,date,boolean) to authenticated;
commit;
