-- A late model response must not reopen a cancelled/authorized/paid invoice.
begin;
create or replace function public.payguard_finish_extraction(p_invoice uuid,p_lease uuid,p_data jsonb,p_error text)
returns boolean language plpgsql security definer set search_path='' as $$
declare item public.invoices%rowtype;
begin
 select * into item from public.invoices where id=p_invoice for update;
 if item.id is null or item.extraction_state<>'processing' or item.extraction_lease is distinct from p_lease or p_lease is null then return false; end if;
 if item.status not in ('processing','needs_review') then
  update public.invoices set extraction_state='failed',extraction_lease=null,extraction_error='CLOSED' where id=p_invoice;
  insert into public.audit_events(company_id,event_type,entity_id) values(item.company_id,'extraction_ignored_closed_invoice',p_invoice);
  return false;
 end if;
 if p_error is null and (p_data is null or jsonb_typeof(p_data)<>'object' or jsonb_typeof(p_data->'fields') is distinct from 'object') then raise exception 'Invalid extraction result'; end if;
 update public.invoices set extraction_state=case when p_error is null then 'completed' else 'failed' end,
  extraction_lease=null,extraction_error=left(p_error,80),status='needs_review',
  extracted_data=case when p_error is null then p_data else '{}'::jsonb end,
  review_reasons=jsonb_build_array(case when p_error is null then 'Extracción pendiente de confirmación humana' else 'Extracción fallida: requiere reintento o revisión' end)
 where id=p_invoice;
 insert into public.audit_events(company_id,event_type,entity_id,details)
 values(item.company_id,case when p_error is null then 'extraction_completed' else 'extraction_failed' end,p_invoice,jsonb_build_object('attempt',item.extraction_attempts,'error_code',p_error));
 return true;
end $$;
commit;
