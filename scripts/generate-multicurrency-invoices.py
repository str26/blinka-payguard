"""Generate synthetic PayGuard fixtures; no credentials, services, or balance changes."""
from pathlib import Path
from decimal import Decimal
import argparse,json,uuid,hashlib
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle
from pypdf import PdfReader,PdfWriter
P=argparse.ArgumentParser();P.add_argument('--batch',default='MC261017');args=P.parse_args()
if not args.batch.replace('-','').isalnum() or len(args.batch)>24:raise SystemExit('Batch: letters, digits and hyphens; max 24 characters.')
root=Path(__file__).resolve().parents[1];kit=root/'output/multicurrency-kit';out=kit/'output/pdf';out.mkdir(parents=True,exist_ok=True)
company='10000000-0000-4000-8000-000000000001';suppliers={'CO':('20000000-0000-4000-8000-000000000001','DEMO-CO','Andes Demo Services'),'MX':('20000000-0000-4000-8000-000000000002','DEMO-MX','Pacifico Demo Studio'),'NO':('20000000-0000-4000-8000-000000000003','DEMO-NEW','Proveedor Demo Pendiente')}
configs={
 'USD':{'supplier':'CO','auto':'800.00','approval':'1500.00','mismatch':'900.00','absolute':'3500.00','denied':'100.00','auto_ref':'DEMO-USD-001','approval_ref':'DEMO-USD-1500','automatic_limit':'1000.00','absolute_limit':'3000.00'},
 'COP':{'supplier':'CO','auto':'1000000.00','approval':'5000000.00','mismatch':'1100000.00','absolute':'13000000.00','denied':'100000.00','auto_ref':'MC-COP-AUTO','approval_ref':'MC-COP-APPROVAL','automatic_limit':'4000000.00','absolute_limit':'12000000.00'},
 'MXN':{'supplier':'MX','auto':'15000.00','approval':'25000.00','mismatch':'16000.00','absolute':'61000.00','denied':'1000.00','auto_ref':'DEMO-MXN-001','approval_ref':'MC-MXN-APPROVAL','automatic_limit':'20000.00','absolute_limit':'60000.00'}}
ink=colors.HexColor('#1C253A');muted=colors.HexColor('#656975');blue=colors.HexColor('#2A4BD0');line=colors.HexColor('#DEDFDC')
body=ParagraphStyle('body',fontName='Helvetica',fontSize=10.5,leading=17,textColor=ink)
small=ParagraphStyle('small',parent=body,fontSize=8.5,leading=13,textColor=muted)
label=ParagraphStyle('label',parent=body,fontName='Helvetica-Bold',fontSize=9,leading=14)
heading=ParagraphStyle('heading',parent=body,fontName='Helvetica-Bold',fontSize=27,leading=34)
manifest=[];agreements=[]
def agreement(reference,amount,currency,supplier):
 item={'reference':reference,'amount':amount,'currency':currency,'supplier':suppliers[supplier][0]}
 if item not in agreements:agreements.append(item)
def build(path,number,currency,amount,reference,supplier):
 doc=SimpleDocTemplate(str(path),pagesize=A4,leftMargin=48,rightMargin=48,topMargin=42,bottomMargin=45,title='Factura ficticia '+number,author='PayGuard synthetic test fixtures')
 banner=Table([[Paragraph('DOCUMENTO FICTICIO PARA DEMOSTRACIÓN - SIN VALIDEZ FISCAL',label)]],colWidths=[499])
 banner.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#fff5df')),('BOX',(0,0),(-1,-1),.5,colors.HexColor('#dfc78b')),('TOPPADDING',(0,0),(-1,-1),12),('BOTTOMPADDING',(0,0),(-1,-1),12),('LEFTPADDING',(0,0),(-1,-1),12)]))
 sid,code,name=suppliers[supplier]
 story=[banner,Spacer(1,30),Paragraph('Factura de servicios',heading),Spacer(1,10),Paragraph('Número de factura: <b>'+number+'</b>',body),Spacer(1,27)]
 data=[['PROVEEDOR','CLIENTE'],[name,'Atlas Demo Global LLC'],['Código del proveedor: '+code,'Empresa ficticia de demostración']]
 table=Table([[Paragraph(c,label if i==0 else body) for c in row] for i,row in enumerate(data)],colWidths=[250,249]);table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),12),('BOTTOMPADDING',(0,0),(-1,-1),7)]))
 story += [table,Spacer(1,22),Paragraph('Referencia del acuerdo: <b>'+reference+'</b>',body),Paragraph('Fecha de emisión: <b>2026-10-17</b>',body),Paragraph('Fecha de vencimiento: <b>2026-10-20</b>',body),Spacer(1,25)]
 items=Table([[Paragraph('DESCRIPCIÓN',label),Paragraph('MONEDA',label),Paragraph('IMPORTE',label)],[Paragraph('Servicio ficticio mensual',body),Paragraph(currency,body),Paragraph(amount,body)]],colWidths=[275,70,154]);items.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#edf1fc')),('LINEBELOW',(0,1),(-1,1),.5,line),('TOPPADDING',(0,0),(-1,-1),13),('BOTTOMPADDING',(0,0),(-1,-1),13)]))
 story += [items,Spacer(1,25),Paragraph('Total por pagar: <b>'+currency+' '+amount+'</b>',ParagraphStyle('total',parent=body,fontSize=21,leading=28,textColor=blue)),Spacer(1,30),Paragraph('Datos totalmente sintéticos. Sin obligación comercial ni instrucciones bancarias. Uso exclusivo en una aplicación de simulación; no realizar transferencias reales.',small)]
 def footer(canvas,doc):
  canvas.setStrokeColor(line);canvas.line(48,43,547,43);canvas.setFillColor(muted);canvas.setFont('Helvetica',8);canvas.drawString(48,28,'PayGuard | Factura sintética de prueba | '+currency);canvas.drawRightString(547,28,'1 / 1')
 doc.build(story,onFirstPage=footer)
for currency,c in configs.items():
 supplier=c['supplier'];auto_ref=c['auto_ref'];app_ref=c['approval_ref'];abs_ref=f'MC-{currency}-ABSOLUTE';denied_ref=f'MC-{currency}-DENIED'
 for ref,amount,sup in [(auto_ref,c['auto'],supplier),(app_ref,c['approval'],supplier),(abs_ref,c['absolute'],supplier),(denied_ref,c['denied'],'NO')]:agreement(ref,amount,currency,sup)
 cases=[('01-auto',c['auto'],auto_ref,supplier,'paid_simulated','Todos los controles válidos.'),('02-auto',c['auto'],auto_ref,supplier,'paid_simulated','Todos los controles válidos; nuevo número, mismo acuerdo.'),('03-approval',c['approval'],app_ref,supplier,'pending_approval','Importe superior al umbral automático; demás controles válidos. Tras aprobación: paid_simulated.'),('04-mismatch',c['mismatch'],auto_ref,supplier,'blocked','Importe de factura distinto al acuerdo.'),('05-absolute',c['absolute'],abs_ref,supplier,'blocked','Supera el límite absoluto.'),('06-denied',c['denied'],denied_ref,'NO','blocked','Proveedor registrado pero no permitido.'),('07-funds',c['approval'],app_ref,supplier,'blocked_if_precondition','Disponible de wallet menor al importe; presupuesto suficiente.'),('08-budget',c['approval'],app_ref,supplier,'blocked_if_precondition','Wallet suficiente; presupuesto disponible menor al importe.')]
 for tag,amount,ref,sup,expected,condition in cases:
  number=f'{args.batch}-{currency}-{tag.upper()}';path=out/f'{currency}-{tag}.pdf';build(path,number,currency,amount,ref,sup)
  manifest.append({'file':str(path.relative_to(kit)),'invoice_number':number,'currency':currency,'amount':amount,'supplier_code':suppliers[sup][1],'supplier_name':suppliers[sup][2],'agreement_reference':ref,'issue_date':'2026-10-17','due_date':'2026-10-20','expected':expected,'condition':condition,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()})
 original=next(x for x in manifest if x['file']==f'output/pdf/{currency}-01-auto.pdf');path=out/f'{currency}-09-duplicate.pdf'
 writer=PdfWriter();writer.clone_document_from_reader(PdfReader(kit/original['file']));writer.add_metadata({'/Subject':'Synthetic semantic-duplicate fixture; same invoice content, different file metadata'})
 with path.open('wb') as f:writer.write(f)
 item=dict(original);item.update(file=str(path.relative_to(kit)),expected='needs_review_or_duplicate_rejected',condition='Cargar DESPUÉS de 01-auto. Misma factura y proveedor, hash distinto: nunca crear otro pago.',sha256=hashlib.sha256(path.read_bytes()).hexdigest());manifest.append(item)
 assert item['sha256']!=original['sha256']
(kit/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
setup=kit/'supabase/setup';setup.mkdir(parents=True,exist_ok=True)
sql=["-- Synthetic agreement fixtures only. No balance, budget, policy or role updates.","begin;","do $$",f"declare company uuid:='{company}';","begin", " if not exists(select 1 from public.companies where id=company and is_demo) then raise exception 'Expected fictional company missing';end if;"]
for a in agreements:
 uid=str(uuid.uuid5(uuid.NAMESPACE_URL,'payguard-multicurrency:'+a['reference']));ref=a['reference'];supplier=a['supplier'];currency=a['currency'];amount=a['amount']
 sql += [f" if not exists(select 1 from public.suppliers where id='{supplier}' and company_id=company) then raise exception 'Expected demo supplier missing';end if;",f" if exists(select 1 from public.agreements where company_id=company and reference='{ref}' and (supplier_id<>'{supplier}' or currency<>'{currency}' or amount<>{amount})) then raise exception 'Existing agreement {ref} differs from test fixture';end if;",f" insert into public.agreements(id,company_id,supplier_id,reference,currency,amount,description)",f" select '{uid}',company,'{supplier}','{ref}','{currency}',{amount},'Acuerdo ficticio para pruebas multimoneda'",f" where not exists(select 1 from public.agreements where company_id=company and reference='{ref}');"]
sql += ['end $$;',f"select reference,currency,amount from public.agreements where company_id='{company}' and (reference like 'MC-%' or reference in ('DEMO-USD-001','DEMO-USD-1500','DEMO-MXN-001')) order by currency,amount;",'commit;']
(setup/'multicurrency_agreements.sql').write_text('\n'.join(sql)+'\n')
# Read-only readiness query, no balances or reservations are modified.
(setup/'multicurrency_readiness.sql').write_text(f"""-- Read only. Available funds and current budget, not just accounting balances.
select w.currency,w.balance,w.reserved,w.available as wallet_available,b.period,b.total,b.spent,b.reserved as budget_reserved,b.available as budget_available,p.automatic_limit,p.absolute_limit,c.agent_enabled
from public.wallets w join public.companies c on c.id=w.company_id
left join public.budgets b on b.company_id=w.company_id and b.currency=w.currency and b.period=date_trunc('month',now() at time zone 'America/Bogota')::date
left join public.policies p on p.company_id=w.company_id and p.currency=w.currency and p.active
where w.company_id='{company}' order by w.currency;
""")
print(f'Generated {len(manifest)} PDFs and {len(agreements)} agreement definitions in {kit}')
