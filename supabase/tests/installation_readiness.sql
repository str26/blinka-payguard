-- Read-only. Safe for the intended Supabase project: no fixtures or writes.
-- 1) Expected tables, tenant RLS and client grants.
with expected(name) as (values
 ('companies'),('company_members'),('suppliers'),('agreements'),('policies'),('wallets'),('budgets'),('documents'),('invoices'),('decisions'),('approvals'),('reservations'),('wallet_movements'),('audit_events'),('operation_requests'),('invoice_reviews')
)
select e.name as tabla,c.oid is not null as existe,coalesce(c.relrowsecurity,false) as rls_activo,
 coalesce(has_table_privilege('authenticated',c.oid,'SELECT'),false) as lectura_autenticada,
 coalesce(has_table_privilege('anon',c.oid,'SELECT'),false) as lectura_anonima_debe_ser_false,
 coalesce(has_table_privilege('authenticated',c.oid,'INSERT,UPDATE,DELETE'),false) as escritura_cliente_debe_ser_false
from expected e left join pg_class c on c.oid=to_regclass('public.'||e.name) order by e.name;

-- 2) Expected RPC signatures and caller grants (no RPC is executed).
with expected(signature,caller) as (values
 ('public.payguard_register_document(uuid,uuid,text,text,bigint,text)','authenticated'),
 ('public.payguard_claim_extraction(uuid)','authenticated'),
 ('public.payguard_finish_extraction(uuid,uuid,jsonb,text)','service_role'),
 ('public.payguard_confirm_invoice(uuid,uuid,integer,uuid,uuid,text,text,text,date,date,boolean)','authenticated'),
 ('public.payguard_process_invoice(uuid,text,uuid,uuid,text)','authenticated'),
 ('public.payguard_refund_invoice(uuid,uuid,text,text)','authenticated')
)
select signature as funcion,caller as rol_esperado,to_regprocedure(signature) is not null as existe,
 coalesce(has_function_privilege(caller,to_regprocedure(signature),'EXECUTE'),false) as rol_puede_ejecutar,
 coalesce(has_function_privilege('anon',to_regprocedure(signature),'EXECUTE'),false) as anon_puede_ejecutar_debe_ser_false
from expected order by signature;

-- 3) Direct financial writes with a server key must remain disabled.
select c.relname as tabla,has_table_privilege('service_role',c.oid,'INSERT,UPDATE,DELETE') as escritura_directa_debe_ser_false
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relname in ('wallets','budgets','reservations','wallet_movements') order by c.relname;

-- 4) Storage and reference data. No email, credential or document content is selected.
select id,public as publico_debe_ser_false,file_size_limit,allowed_mime_types from storage.buckets where id='payguard-invoices';
select c.name as empresa,m.role,count(*) as usuarios from public.company_members m join public.companies c on c.id=m.company_id group by c.name,m.role order by c.name,m.role;
select currency,version,automatic_limit,absolute_limit from public.policies where company_id='10000000-0000-4000-8000-000000000001' and active order by currency;
select currency,balance,reserved,available from public.wallets where company_id='10000000-0000-4000-8000-000000000001' order by currency;
select currency,period,total,reserved,spent,available from public.budgets where company_id='10000000-0000-4000-8000-000000000001' order by period desc,currency;

-- 5) Verify the terminal-state extraction guard from migration 005 by its audit event.
select coalesce(position('extraction_ignored_closed_invoice' in pg_get_functiondef(to_regprocedure('public.payguard_finish_extraction(uuid,uuid,jsonb,text)')))>0,false) as proteccion_extraccion_tardia_005;
