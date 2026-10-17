-- Requires 001 and 002. Storage stays private; no browser write policies are added.
begin;
alter table public.invoices
 add column extraction_state text not null default 'pending' check(extraction_state in ('pending','processing','completed','failed')),
 add column extraction_attempts integer not null default 0 check(extraction_attempts between 0 and 3),
 add column extraction_lease uuid,
 add column extraction_started_at timestamptz,
 add column extraction_error text;
create unique index invoices_one_document_idx on public.invoices(document_id);

create function public.payguard_register_document(p_company uuid,p_document uuid,p_name text,p_mime text,p_size bigint,p_sha text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); existing uuid; invoice uuid; path text;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_company::text,0));
 if actor is null or not exists(select 1 from public.company_members where company_id=p_company and user_id=actor and role in ('admin','operator')) then
  raise exception 'Upload access denied' using errcode='42501';
 end if;
 select i.id into existing from public.documents d join public.invoices i on i.document_id=d.id where d.company_id=p_company and d.sha256=p_sha;
 if existing is not null then return jsonb_build_object('id',existing,'duplicate',true); end if;
 if (select count(*) from public.documents where company_id=p_company and created_at>now()-interval '1 hour')>=30 then
  raise exception 'Upload rate limit' using errcode='P0001';
 end if;
 if p_size>3145728 or p_size<=0 or length(p_name)>200 or length(btrim(p_name))=0 then raise exception 'Invalid file'; end if;
 path:=p_company::text||'/'||p_document::text;
 insert into public.documents(id,company_id,uploaded_by,original_name,storage_path,mime_type,byte_size,sha256)
 values(p_document,p_company,actor,p_name,path,p_mime,p_size,p_sha);
 insert into public.invoices(company_id,document_id,review_reasons) values(p_company,p_document,'["Pendiente de extracción y revisión humana"]'::jsonb) returning id into invoice;
 insert into public.audit_events(company_id,actor_id,event_type,entity_id) values(p_company,actor,'invoice_uploaded',invoice);
 return jsonb_build_object('id',invoice,'duplicate',false);
end $$;

create function public.payguard_claim_extraction(p_invoice uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); item public.invoices%rowtype; company uuid; lease uuid:=gen_random_uuid(); doc public.documents%rowtype;
begin
 select company_id into company from public.invoices where id=p_invoice;
 if actor is null or not exists(select 1 from public.company_members where company_id=company and user_id=actor and role in ('admin','operator')) then
  raise exception 'Extraction access denied' using errcode='42501';
 end if;
 perform pg_advisory_xact_lock(hashtextextended(company::text,0));
 select * into item from public.invoices where id=p_invoice for update;
 if item.extraction_state='completed' then return jsonb_build_object('state','completed'); end if;
 if item.status not in ('received','processing','needs_review') then raise exception 'Invoice is not editable'; end if;
 if item.extraction_state='processing' and item.extraction_started_at>now()-interval '3 minutes' then return jsonb_build_object('state','busy'); end if;
 if item.extraction_attempts>=3 then return jsonb_build_object('state','limit'); end if;
 if (select count(*) from public.audit_events where company_id=company and event_type='extraction_started' and created_at>now()-interval '1 hour')>=30 then return jsonb_build_object('state','rate_limit'); end if;
 select * into doc from public.documents where id=item.document_id;
 update public.invoices set extraction_state='processing',extraction_started_at=now(),extraction_lease=lease,
  extraction_attempts=extraction_attempts+1,extraction_error=null,status='processing' where id=p_invoice;
 insert into public.audit_events(company_id,actor_id,event_type,entity_id) values(company,actor,'extraction_started',p_invoice);
 return jsonb_build_object('state','claimed','lease',lease,'path',doc.storage_path,'mime',doc.mime_type,'sha256',doc.sha256,'size',doc.byte_size);
end $$;

-- Only the trusted backend can submit model results. It never populates payable fields.
create function public.payguard_finish_extraction(p_invoice uuid,p_lease uuid,p_data jsonb,p_error text)
returns boolean language plpgsql security definer set search_path='' as $$
declare item public.invoices%rowtype;
begin
 select * into item from public.invoices where id=p_invoice for update;
 if item.id is null or item.extraction_state<>'processing' or item.extraction_lease is distinct from p_lease or p_lease is null then return false; end if;
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
revoke all on function public.payguard_register_document(uuid,uuid,text,text,bigint,text) from public,anon,service_role;
revoke all on function public.payguard_claim_extraction(uuid) from public,anon,service_role;
revoke all on function public.payguard_finish_extraction(uuid,uuid,jsonb,text) from public,anon,authenticated;
grant execute on function public.payguard_register_document(uuid,uuid,text,text,bigint,text),public.payguard_claim_extraction(uuid) to authenticated;
grant execute on function public.payguard_finish_extraction(uuid,uuid,jsonb,text) to service_role;
commit;
