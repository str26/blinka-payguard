import {getI18n} from '@/lib/i18n/server';
import { redirect,notFound } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fieldLabels,fieldNames,validateExtraction } from '@/modules/invoices/domain/extraction';
import { extractionMessages } from '@/modules/invoices/server/gemini';
import { UUID } from '@/modules/invoices/server/access';
import { statusLabels } from '@/modules/invoices/domain/review';
import ReviewForm, { type SupplierOption, type AgreementOption } from './review-form';
import DecisionPanel, { type DecisionView, type ReservationView } from './decision-panel';
import { liquidityAlerts } from '@/modules/invoices/domain/liquidity';
import { refundSummary } from '@/modules/invoices/domain/refunds';
import AgentPanel, { type AgentRunView } from './agent-panel';
import RefundForm from './refund-form';
import FinancialActions from './financial-actions';
import RetryButton from './retry-button';
import styles from '../../workspace.module.css';
export const dynamic='force-dynamic';
export default async function Invoice({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{pipeline?:string}>}) {
 const {t,locale}=await getI18n();

  const {id}=await params;if(!UUID.test(id))notFound();
  const client=await createSupabaseServerClient();const {data:{user},error}=await client.auth.getUser();
  if(error || !user)redirect('/login');
  const result=await client.from('invoices').select('id,company_id,status,extraction_state,extraction_attempts,extraction_error,extracted_data,document_id,version,supplier_id,agreement_id,invoice_number,currency,amount::text,issue_date,due_date').eq('id',id).maybeSingle();
  if(result.error)return <main className={styles.workspace}><h1>{t("No se pudo cargar la factura")}</h1><p>{t("Verifica las migraciones y vuelve a intentar.")}</p></main>;
  if(!result.data)notFound();const invoice=result.data;
  const [doc,membership,suppliers,agreements,decisions,reservations,payments,audit,approvals,refunds,company,agentRuns]=await Promise.all([
    client.from('documents').select('original_name,sha256').eq('id',invoice.document_id).single(),
    client.from('company_members').select('role').eq('company_id',invoice.company_id).eq('user_id',user.id).single(),
    client.from('suppliers').select('id,code,name,allowed').eq('company_id',invoice.company_id).order('name'),
    client.from('agreements').select('id,supplier_id,reference,currency,amount::text').eq('company_id',invoice.company_id).order('reference'),
    client.from('decisions').select('id,status,invoice_version,checks,input_snapshot,created_at,policy_currency:input_snapshot->policy->>currency,policy_version:input_snapshot->policy->>version,automatic_limit:input_snapshot->policy->>automatic_limit,absolute_limit:input_snapshot->policy->>absolute_limit').eq('invoice_id',id).order('decision_order',{ascending:false}).limit(1),
    client.from('reservations').select('currency,amount::text,status').eq('invoice_id',id).eq('status','active').limit(1),
    client.from('wallet_movements').select('id,currency,amount::text,created_at').eq('invoice_id',id).eq('kind','payment_simulated').limit(1),
    client.from('audit_events').select('id,event_type,actor_id,created_at').eq('entity_id',id).order('created_at',{ascending:false}).limit(15),
    client.from('approvals').select('id,action,reason,actor_id,created_at').eq('invoice_id',id).order('created_at',{ascending:false}).limit(10),
    client.from('wallet_movements').select('id,original_movement_id,currency,amount::text,description,created_at',{count:'exact'}).eq('invoice_id',id).eq('kind','refund_received').order('created_at',{ascending:false}).limit(1001),
    client.from('companies').select('agent_enabled').eq('id',invoice.company_id).single(),
    client.from('agent_runs').select('id,state,source,actor_id,steps,reasons,created_at').eq('invoice_id',id).order('run_order',{ascending:false}).limit(1),
  ]);
  const pipelineError=(await searchParams).pipeline==='error';
  const agentEnabled=company.data?.agent_enabled===true;
  let extraction=null;
  if(invoice.extraction_state==='completed') {try{extraction=validateExtraction(invoice.extracted_data);}catch{/* Corrupt data is never displayed as verified. */}}
  const supplierOptions=(suppliers.data??[]) as SupplierOption[];
  const agreementOptions=(agreements.data??[]) as AgreementOption[];
  const proposed=extraction?.fields;
  const code=proposed?.supplier_code.value?.trim().toLowerCase();
  const name=proposed?.supplier_name.value?.trim().toLowerCase();
  const byCode=code?supplierOptions.filter(s=>s.code.toLowerCase()===code):[];
  const byName=name?supplierOptions.filter(s=>s.name.toLowerCase()===name):[];
  const suggestedSupplier=byCode.length===1?byCode[0].id:byName.length===1?byName[0].id:'';
  const supplier=invoice.supplier_id??suggestedSupplier;
  const currency=invoice.currency??proposed?.currency.value??'';
  const matching=agreementOptions.filter(a=>a.supplier_id===supplier && a.currency===currency && a.reference.toLowerCase()===proposed?.agreement_reference.value?.trim().toLowerCase());
  const initial={supplier_id:supplier,agreement_id:invoice.agreement_id??(matching.length===1?matching[0].id:''),invoice_number:invoice.invoice_number??proposed?.invoice_number.value??'',currency,
    amount:invoice.amount??proposed?.amount.value??'',issue_date:invoice.issue_date??proposed?.issue_date.value??'',due_date:invoice.due_date??proposed?.due_date.value??''};
  const canReview=membership.data && ['admin','operator'].includes(membership.data.role) && ['needs_review','blocked'].includes(invoice.status);
  const latestDecision=decisions.data?.[0];
  const liquidityErrors=invoice.status==='blocked'&&latestDecision&&latestDecision.invoice_version===invoice.version?liquidityAlerts(latestDecision.checks,latestDecision.input_snapshot):[];
  let refundsSummary:ReturnType<typeof refundSummary>|null=null;
  if(invoice.status==='paid_simulated' && !payments.error && payments.data[0] && !refunds.error){
    try{
      if(refunds.count!==refunds.data.length || refunds.data.length>1000 || refunds.data.some(r=>r.original_movement_id!==payments.data[0].id || r.currency!==payments.data[0].currency))throw new Error('Inconsistent refunds');
      refundsSummary=refundSummary(payments.data[0].amount,refunds.data.map(r=>r.amount));
    }catch{/* Inconsistent or truncated ledger data cannot authorize another refund. */}
  }
  return <main className={styles.workspace}>
    <Link className={styles.back} href={`/invoices?company=${invoice.company_id}`}>{t("← Facturas")}</Link>
    <p className={styles.eyebrow}>{t("FACTURA · EXTRACCIÓN Y DECISIÓN")}</p><h1 className={styles.title}>{doc.data?.original_name ?? t('Factura')}</h1>
    <p>{t("Extracción: ")}<strong>{t(invoice.extraction_state)}</strong>{t(" · Intentos: ")}{t(invoice.extraction_attempts)}{t("/3 · Estado: ")}{t(statusLabels[invoice.status]??invoice.status)}</p>
    <p><a className={styles.back} href={`/api/invoices/${id}/document`} target="_blank" rel="noopener noreferrer">{t("Abrir documento original ↗")}</a></p>
    {liquidityErrors.length>0&&<section role="alert" className={styles.error}><h2>{t("Pago detenido")}</h2>{liquidityErrors.map(message=><p key={message}>{t(message)}</p>)}<p>{t("Importes de la última evaluación. Revisa el disponible en el panel y, después de resolver la falta de fondos o presupuesto, pulsa «Reevaluar y continuar con el agente». Confirmar datos o aprobar no evita este control.")}</p></section>}
    {pipelineError&&<p className={styles.error}>{t("El procesamiento no terminó. Consulta el estado y los motivos; puedes reintentar el agente.")}</p>}
    {company.error||agentRuns.error?<p className={styles.error}>{t("No se pudo consultar el agente. Verifica la migración 007 y su configuración.")}</p>:agentRuns.data[0]?<AgentPanel run={agentRuns.data[0] as AgentRunView}/>:agentEnabled&&<p className={styles.note}>{t("Agente habilitado. Aún no hay una ejecución registrada para esta factura.")}</p>}
    {agentEnabled&&!['paid_simulated','cancelled','pending_approval'].includes(invoice.status)&&membership.data&&['admin','operator'].includes(membership.data.role)&&invoice.extraction_state==='completed'&&<RetryButton id={id}/>}
    {invoice.extraction_error && <p className={styles.error}>{t(extractionMessages[invoice.extraction_error] ?? 'No se pudo completar la extracción.')}</p>}
    {extraction ? <>
      <div className={styles.tableWrap}><table><thead><tr><th>{t("Campo")}</th><th>{t("Valor propuesto")}</th><th>{t("Evidencia citada por Gemini")}</th></tr></thead><tbody>{fieldNames.map(key=><tr key={key}><th>{t(fieldLabels[key])}</th><td>{extraction.fields[key].value ?? t('No confirmado')}</td><td>{extraction.fields[key].evidence ?? t('Sin evidencia')}</td></tr>)}</tbody></table></div>
      {extraction.warnings.length>0 && <section className={styles.section}><h2>{t("Avisos originales del documento")}</h2><ul>{extraction.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul></section>}
      <p className={styles.note}>{t("Compara cada dato con el original. Las citas también son generadas por IA y pueden contener errores. La extracción se conserva. El agente ejecuta el flujo automático; las excepciones admiten corrección humana antes de una nueva evaluación.")}</p>
    </> : <><p>{t("No hay una extracción validada disponible. Si el proceso se interrumpió, espera tres minutos y reintenta.")}</p>{membership.data && ['admin','operator'].includes(membership.data.role) && !['authorized','paid_simulated','cancelled'].includes(invoice.status) && invoice.extraction_attempts<3 && invoice.extraction_state!=='completed' && <RetryButton id={id}/>}</>}
    {invoice.supplier_id && <section className={styles.section}><h2>{t("Datos usados para validar la operación")}</h2><dl className={styles.confirmed}><dt>{t("Factura")}</dt><dd>{invoice.invoice_number}</dd><dt>{t("Proveedor")}</dt><dd>{supplierOptions.find(s=>s.id===invoice.supplier_id)?.name??t('Proveedor registrado')}</dd><dt>{t("Acuerdo")}</dt><dd>{agreementOptions.find(a=>a.id===invoice.agreement_id)?.reference??t('Sin acuerdo confirmado')}</dd><dt>{t("Importe")}</dt><dd>{invoice.currency} {invoice.amount}</dd><dt>{t("Emisión / vencimiento")}</dt><dd>{invoice.issue_date}{t(" / ")}{invoice.due_date}</dd></dl></section>}
    {invoice.status==='paid_simulated' && <section className={styles.section}><p className={styles.eyebrow}>{t("COMPROBANTE DE SIMULACIÓN")}</p><h2>{t("Pago simulado completado")}</h2>{payments.error || !payments.data[0]?<p className={styles.error}>{t("No se pudo consultar el movimiento. No ejecutes otro pago; recarga para comprobarlo.")}</p>:<><p className={styles.description}>{t("Importe debitado: ")}<strong>{payments.data[0].currency} {payments.data[0].amount}</strong>{t(".")}</p><p className={styles.note}>{t("Movimiento: ")}{payments.data[0].id}{t(" · Fecha: ")}{t(new Date(payments.data[0].created_at).toLocaleString(locale==='en'?'en-US':'es-CO',{timeZone:'America/Bogota'}))}{t(" (Colombia).")}</p><p>{t("El pago original consumió la reserva y registró el gasto. Los reembolsos recibidos se muestran por separado. Es un comprobante de simulación, sin transferencia bancaria real.")}</p></>}<Link className={styles.back} href={`/dashboard?company=${invoice.company_id}`}>{t("Ver saldos actualizados →")}</Link></section>}
    {invoice.status==='paid_simulated' && <section className={styles.section}><h2>{t("Devoluciones recibidas")}</h2>{!refundsSummary?<p className={styles.error}>{t("No se pudo verificar el saldo reembolsable. No registres otra devolución hasta consultar el historial completo.")}</p>:<><p>{t("Pago original: ")}{payments.data?.[0]?.currency} {refundsSummary.paid}{t(" · Total devuelto: ")}{refundsSummary.refunded}{t(" · Máximo aún reembolsable: ")}{refundsSummary.remaining}{t(".")}</p>{refundsSummary.remaining==='0.00'&&<p className={styles.description}>{t("Reembolso total registrado. El pago original se conserva para auditoría; no se permiten más devoluciones sobre él.")}</p>}<div className={styles.tableWrap}><table><thead><tr><th>{t("Importe devuelto")}</th><th>{t("Motivo registrado")}</th><th>{t("Fecha Colombia")}</th></tr></thead><tbody>{refunds.data?.map(r=><tr key={r.id}><td>{r.currency} {r.amount}</td><td>{r.description}</td><td>{t(new Date(r.created_at).toLocaleString(locale==='en'?'en-US':'es-CO',{timeZone:'America/Bogota'}))}</td></tr>)}</tbody></table></div></>}</section>}
    {invoice.status==='paid_simulated' && refundsSummary && refundsSummary.remaining!=='0.00' && !membership.error && membership.data && ['admin','approver'].includes(membership.data.role) && <RefundForm key={refundsSummary.remaining} id={id} currency={payments.data![0].currency} remaining={refundsSummary.remaining}/>}
    {invoice.status==='cancelled' && <p className={styles.description}>{t("Factura cancelada definitivamente. La operación libera cualquier reserva activa; no debita la wallet ni ejecuta un reembolso.")}</p>}
    {decisions.error || reservations.error ? <p className={styles.error}>{t("No se pudo consultar la decisión o sus reservas. Recarga antes de continuar.")}</p> : decisions.data[0] && <DecisionPanel decision={decisions.data[0] as DecisionView} version={invoice.version} reservation={(reservations.data[0] as ReservationView|undefined)??null} invoiceStatus={invoice.status} company={invoice.company_id}/>}
    {invoice.status==='pending_approval' && <section className={styles.section}><h2>{t("Aprobación del gasto pendiente")}</h2><p>{t("Confirmar campos no autoriza este gasto. Un admin o approver debe escribir un motivo y pulsar «Aprobar y continuar con el agente» en Acciones. El agente revalidará las reglas antes de pagar.")}</p>{membership.data?.role==='operator'&&<p className={styles.note}>{t("Tu rol operator puede corregir datos, pero no aprobar este gasto. Solicita la intervención de un admin o approver.")}</p>}</section>}
    {extraction && canReview && (suppliers.error || agreements.error || decisions.error || reservations.error ? <p className={styles.error}>{t("No se puede confirmar hasta cargar proveedores, acuerdos y estado actual.")}</p> : <ReviewForm agentEnabled={agentEnabled} key={invoice.version} id={id} version={invoice.version} initial={initial} suppliers={supplierOptions} agreements={agreementOptions}/>)}
    {membership.error || decisions.error || reservations.error || payments.error || company.error || agentRuns.error ? <p className={styles.error}>{t("No se pueden habilitar acciones hasta consultar permisos y estado actual. Recarga.")}</p> : membership.data && <FinancialActions key={`${invoice.status}-${decisions.data[0]?.id??'none'}`} id={id} status={invoice.status} role={membership.data.role} agentEnabled={agentEnabled} decisionId={decisions.data[0]?.status==='pending_approval' && decisions.data[0].invoice_version===invoice.version?decisions.data[0].id:null}/>}
    {approvals.error ? <p className={styles.error}>{t("No se pudo consultar el historial de aprobaciones.")}</p> : approvals.data.length>0 && <section className={styles.section}><h2>{t("Aprobaciones y rechazos")}</h2><ul>{approvals.data.map(a=><li key={a.id}><strong>{t(a.action==='approve'?'Aprobada':'Rechazada')}</strong>{t(": ")}{a.reason}{t(" · ")}{t(new Date(a.created_at).toLocaleString(locale==='en'?'en-US':'es-CO',{timeZone:'America/Bogota'}))}{t(" (Colombia).")}</li>)}</ul></section>}
    {audit.error ? <p className={styles.error}>{t("No se pudo cargar la auditoría.")}</p> : <section className={styles.section}><h2>{t("Últimos eventos")}</h2><ol>{audit.data.map(event=><li key={event.id}>{t(event.event_type)}{t(" · ")}{t(new Date(event.created_at).toLocaleString(locale==='en'?'en-US':'es-CO',{timeZone:'America/Bogota'}))}{t(" (Colombia)")}<span className={styles.note}>{t(" · Actor: ")}{t(event.actor_id??'Proceso de extracción')}</span></li>)}</ol></section>}
    <p className={styles.note}>{t("SHA-256: ")}{doc.data?.sha256}</p>
    <p className={styles.note}>{t("La extracción no modifica saldos. La autorización reserva fondos; el pago simulado los debita; la cancelación libera reservas y el reembolso recibido acredita la wallet y revierte gasto del presupuesto original. Todas estas acciones quedan registradas.")}</p>
  </main>;
}
