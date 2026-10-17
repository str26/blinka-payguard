"""Synthetic invoice fixtures. Optional: python -m pip install reportlab."""
from pathlib import Path
import argparse,json
from datetime import date
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle

parser=argparse.ArgumentParser();parser.add_argument('--batch',default='DEMO');parser.add_argument('--issue-date',default='2026-10-17');parser.add_argument('--due-date',default='2026-10-20');args=parser.parse_args()
if not args.batch.replace('-','').isalnum() or len(args.batch)>40:raise SystemExit('Use an alphanumeric batch with optional hyphens (max 40).')
try:
 issue=date.fromisoformat(args.issue_date);due=date.fromisoformat(args.due_date)
 if issue.isoformat()!=args.issue_date or due.isoformat()!=args.due_date or due<issue:raise ValueError()
except ValueError:raise SystemExit('Use valid ISO dates; due date cannot precede issue date.')
root=Path(__file__).resolve().parents[1];out=root/'output/pdf';out.mkdir(parents=True,exist_ok=True)
green=colors.HexColor('#143d31');ink=colors.HexColor('#172d27');muted=colors.HexColor('#52675d');line=colors.HexColor('#d9e3dc')
body=ParagraphStyle('body',fontName='Helvetica',fontSize=11,leading=17,textColor=ink)
small=ParagraphStyle('small',parent=body,fontSize=9,leading=14,textColor=muted)
heading=ParagraphStyle('heading',parent=body,fontName='Helvetica-Bold',fontSize=27,leading=33,textColor=green)
label=ParagraphStyle('label',parent=body,fontName='Helvetica-Bold',fontSize=10,leading=16)
scenarios=[('AUTO','demo-auto-001.pdf','800.00','DEMO-USD-001','paid_simulated'),('APPROVAL','demo-approval-001.pdf','1500.00','DEMO-USD-1500','pending_approval'),('BLOCK','demo-block-001.pdf','900.00','DEMO-USD-001','blocked')]
manifest=[]
for tag,filename,amount,agreement,expected in scenarios:
 number=f'{args.batch}-{tag}-001';path=out/filename
 doc=SimpleDocTemplate(str(path),pagesize=A4,rightMargin=48,leftMargin=48,topMargin=45,bottomMargin=45,title=f'Factura ficticia {number}',author='PayGuard demo fixtures')
 banner=Table([[Paragraph('DOCUMENTO FICTICIO PARA DEMOSTRACIÓN<br/>SIN VALIDEZ FISCAL. NO PAGAR.',label)]],colWidths=[499])
 banner.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#fff4d8')),('BOX',(0,0),(-1,-1),0.7,colors.HexColor('#dfc78b')),('LEFTPADDING',(0,0),(-1,-1),13),('TOPPADDING',(0,0),(-1,-1),11),('BOTTOMPADDING',(0,0),(-1,-1),11)]))
 story=[banner,Spacer(1,32),Paragraph('Factura de servicios',heading),Spacer(1,10),Paragraph(f'Número de factura: <b>{number}</b>',body),Spacer(1,28)]
 details=[['PROVEEDOR','CLIENTE'],['Andes Demo Services','Atlas Demo Global LLC'],['Código del proveedor: DEMO-CO','Empresa ficticia de demostración']]
 table=Table([[Paragraph(cell,label if i==0 else body) for cell in row] for i,row in enumerate(details)],colWidths=[249,250])
 table.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),15),('BOTTOMPADDING',(0,0),(-1,-1),8)]));story.extend([table,Spacer(1,24)])
 story.extend([Paragraph(f'Referencia del acuerdo: <b>{agreement}</b>',body),Paragraph(f'Fecha de emisión: <b>{args.issue_date}</b>',body),Paragraph(f'Fecha de vencimiento: <b>{args.due_date}</b>',body),Spacer(1,25)])
 rows=[[Paragraph('DESCRIPCIÓN',label),Paragraph('MONEDA',label),Paragraph('IMPORTE',label)],[Paragraph('Servicio ficticio mensual',body),Paragraph('USD',body),Paragraph(amount,body)]]
 items=Table(rows,colWidths=[300,85,114]);items.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#edf3ee')),('LINEBELOW',(0,0),(-1,0),0.7,line),('LINEBELOW',(0,1),(-1,1),0.7,line),('TOPPADDING',(0,0),(-1,-1),14),('BOTTOMPADDING',(0,0),(-1,-1),14),('VALIGN',(0,0),(-1,-1),'TOP')]));story.extend([items,Spacer(1,24),Paragraph(f'Total por pagar: <b>USD {amount}</b>',ParagraphStyle('total',parent=body,fontName='Helvetica-Bold',fontSize=20,leading=27,textColor=green)),Spacer(1,35),Paragraph('Datos totalmente sintéticos. Esta factura no representa una obligación comercial ni contiene instrucciones bancarias. Se utiliza únicamente para probar extracción y reglas de una aplicación de simulación.',small)])
 def footer(canvas,_doc):
  canvas.setStrokeColor(line);canvas.line(48,43,547,43);canvas.setFillColor(muted);canvas.setFont('Helvetica',8);canvas.drawString(48,28,'Atlas Demo Global LLC | Documento sintético de prueba');canvas.drawRightString(547,28,'1 / 1')
 doc.build(story,onFirstPage=footer)
 manifest.append({'file':str(path.relative_to(root)),'invoice_number':number,'supplier_code':'DEMO-CO','agreement_reference':agreement,'currency':'USD','amount':amount,'issue_date':args.issue_date,'due_date':args.due_date,'expected_after_agent':expected})
(root/'examples/demo-invoices.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Generated 3 synthetic PDFs and examples/demo-invoices.json')
