begin;

create function payguard_private.refund_invoice(p_invoice uuid,p_request uuid,p_amount text,p_reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid:=auth.uid(); company uuid; member_role text; inv public.invoices%rowtype;
 original public.wallet_movements%rowtype; reservation public.reservations%rowtype;
 wal public.wallets%rowtype; bud public.budgets%rowtype; req public.operation_requests%rowtype;
 amount_value numeric; already_refunded numeric; request_input jsonb; result jsonb; movement uuid;
begin
 if actor is null then raise exception 'Authentication required' using errcode='42501'; end if;
 select company_id into company from public.invoices where id=p_invoice;
 select role into member_role from public.company_members where company_id=company and user_id=actor for share;
 if member_role is null or member_role not in ('admin','approver') then raise exception 'Refund access denied' using errcode='42501'; end if;
 if p_request is null or p_amount is null or p_amount !~ '^(0|[1-9][0-9]{0,17})(\.[0-9]{1,2})?$'
  or p_reason is null or length(btrim(p_reason))=0 or length(p_reason)>1000 then raise exception 'Invalid refund input' using errcode='22023'; end if;
 amount_value:=p_amount::numeric;
 if amount_value<=0 then raise exception 'Refund must be positive' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(company::text,0));
 select * into inv from public.invoices where id=p_invoice for update;
 request_input:=jsonb_build_object('action','refund_received','invoice_id',p_invoice,'amount',amount_value::text,'reason',btrim(p_reason));
 select * into req from public.operation_requests where company_id=company and request_id=p_request;
 if found then
  if req.actor_id<>actor or req.invoice_id<>p_invoice or req.input<>request_input then raise exception 'Request already used' using errcode='22023'; end if;
  return req.response;
 end if;
 if inv.status<>'paid_simulated' then raise exception 'Refund requires a paid simulated invoice' using errcode='55000'; end if;
 select * into original from public.wallet_movements where invoice_id=p_invoice and company_id=company and kind='payment_simulated' for share;
 if original.id is null then raise exception 'Original payment unavailable' using errcode='55000'; end if;
 select * into reservation from public.reservations where id=original.reservation_id and company_id=company and invoice_id=p_invoice and status='consumed';
 if reservation.id is null then raise exception 'Original payment reservation unavailable' using errcode='55000'; end if;
 select * into wal from public.wallets where id=original.wallet_id and company_id=company for update;
 select * into bud from public.budgets where id=reservation.budget_id and company_id=company for update;
 select coalesce(sum(amount),0) into already_refunded from public.wallet_movements
 where company_id=company and original_movement_id=original.id and kind='refund_received';
 if amount_value>original.amount-already_refunded then raise exception 'Refund exceeds original payment remainder' using errcode='22023'; end if;
 if wal.id is null or bud.id is null or bud.currency<>original.currency or bud.spent<amount_value then
  raise exception 'Original budget or wallet is inconsistent' using errcode='55000';
 end if;
 -- This models an incoming supplier refund, in the original currency and accounting period.
 update public.wallets set balance=balance+amount_value where id=wal.id;
 update public.budgets set spent=spent-amount_value where id=bud.id;
 insert into public.wallet_movements(company_id,wallet_id,currency,invoice_id,original_movement_id,kind,amount,idempotency_key,description)
 values(company,wal.id,original.currency,p_invoice,original.id,'refund_received',amount_value,p_request,'Reembolso recibido simulado: '||btrim(p_reason)) returning id into movement;
 result:=jsonb_build_object('invoice_id',p_invoice,'status','paid_simulated','refund_id',movement,'original_movement_id',original.id,
  'currency',original.currency,'refund_amount',amount_value::text,'refunded_total',(already_refunded+amount_value)::text,
  'refundable_remaining',(original.amount-already_refunded-amount_value)::text,'budget_period',bud.period,'simulation',true);
 insert into public.audit_events(company_id,actor_id,event_type,entity_id,details)
 values(company,actor,'invoice.refund_received',p_invoice,result||jsonb_build_object('reason',btrim(p_reason)));
 insert into public.operation_requests(company_id,request_id,invoice_id,actor_id,input,response)
 values(company,p_request,p_invoice,actor,request_input,result);
 return result;
end $$;
create function public.payguard_refund_invoice(p_invoice uuid,p_request uuid,p_amount text,p_reason text)
returns jsonb language sql security invoker set search_path='' as $$
 select payguard_private.refund_invoice(p_invoice,p_request,p_amount,p_reason);
$$;
revoke all on function payguard_private.refund_invoice(uuid,uuid,text,text),public.payguard_refund_invoice(uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function payguard_private.refund_invoice(uuid,uuid,text,text),public.payguard_refund_invoice(uuid,uuid,text,text) to authenticated;
commit;
