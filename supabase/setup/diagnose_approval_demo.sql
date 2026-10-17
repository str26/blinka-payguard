-- Read only. Does not approve, debit, reset or change any record.
select i.id,i.invoice_number,i.status,i.version,i.review_reasons,
 i.currency,i.amount,a.reference as agreement,a.amount as agreed_amount,
 c.agent_enabled,
 (select jsonb_build_object('status',d.status,'invoice_version',d.invoice_version,'checks',d.checks,
 'available_funds',d.input_snapshot->'available_funds','available_budget',d.input_snapshot->'available_budget')
 from public.decisions d where d.invoice_id=i.id order by d.decision_order desc limit 1) as latest_decision,
 (select count(*) from public.approvals ap where ap.invoice_id=i.id and ap.action='approve') as recorded_approvals,
 (select count(*) from public.wallet_movements m where m.invoice_id=i.id and m.kind='payment_simulated') as payment_count
from public.invoices i
join public.companies c on c.id=i.company_id
left join public.agreements a on a.id=i.agreement_id
where i.company_id='10000000-0000-4000-8000-000000000001'
 and (i.invoice_number='AGENTE-APPROVAL-001' or i.document_id in
  (select id from public.documents where company_id=i.company_id and original_name ilike '%approval%'))
order by i.created_at desc;
