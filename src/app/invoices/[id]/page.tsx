import { redirect,notFound } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fieldLabels,fieldNames,validateExtraction } from '@/modules/invoices/domain/extraction';
import { extractionMessages } from '@/modules/invoices/server/gemini';
import { UUID } from '@/modules/invoices/server/access';
import { statusLabels } from '@/modules/invoices/domain/review';
import ReviewForm, { type SupplierOption, type AgreementOption } from './review-form';
import DecisionPanel, { type DecisionView, type ReservationView } from './decision-panel';
import { refundSummary } from '@/modules/invoices/domain/refunds';
import RefundForm from './refund-form';
import FinancialActions from './financial-actions';
import RetryButton from './retry-button';
import styles from '../../workspace.module.css';
export const dynamic='force-dynamic';
export default async function Invoice({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;if(!UUID.test(id))notFound();
  const client=await createSupabaseServerClient();const {data:{user},error}=await client.auth.getUser();
  if(error || !user)redirect('/login');
  const result=await client.from('invoices').select('id,company_id,status,extraction_state,extraction_attempts,extraction_error,extracted_data,document_id,version,supplier_id,agreement_id,invoice_number,currency,amount::text,issue_date,due_date').eq('id',id).maybeSingle();
  if(result.error)return <main className={styles.workspace}><h1>No se pudo cargar la factura</h1><p>Verifica las migraciones y vuelve a intentar.</p></main>;
  if(!result.data)notFound();const invoice=result.data;
  const [doc,membership,suppliers,agreements,decisions,reservations,payments,audit,approvals,refunds]=await Promise.all([
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
  ]);
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
  const canReview=membership.data && ['admin','operator'].includes(membership.data.role) && !['authorized','paid_simulated','cancelled'].includes(invoice.status);
  let refundsSummary:ReturnType<typeof refundSummary>|null=null;
  if(invoice.status==='paid_simulated' && !payments.error && payments.data[0] && !refunds.error){
    try{
      if(refunds.count!==refunds.data.length || refunds.data.length>1000 || refunds.data.some(r=>r.original_movement_id!==payments.data[0].id || r.currency!==payments.data[0].currency))throw new Error('Inconsistent refunds');
      refundsSummary=refundSummary(payments.data[0].amount,refunds.data.map(r=>r.amount));
    }catch{/* Inconsistent or truncated ledger data cannot authorize another refund. */}
  }
  return <main className={styles.workspace}>
    <Link className={styles.back} href={`/invoices?company=${invoice.company_id}`}>← Facturas</Link>
    <p className={styles.eyebrow}>FACTURA · EXTRACCIÓN Y DECISIÓN</p><h1 className={styles.title}>{doc.data?.original_name ?? 'Factura'}</h1>
    <p>Extracción: <strong>{invoice.extraction_state}</strong> · Intentos: {invoice.extraction_attempts}/3 · Estado: {statusLabels[invoice.status]??invoice.status}</p>
    <p><a className={styles.back} href={`/api/invoices/${id}/document`} target="_blank" rel="noopener noreferrer">Abrir documento original ↗</a></p>
    {invoice.extraction_error && <p className={styles.error}>{extractionMessages[invoice.extraction_error] ?? 'No se pudo completar la extracción.'}</p>}
    {extraction ? <>
      <div className={styles.tableWrap}><table><thead><tr><th>Campo</th><th>Valor propuesto</th><th>Evidencia citada por Gemini</th></tr></thead><tbody>{fieldNames.map(key=><tr key={key}><th>{fieldLabels[key]}</th><td>{extraction.fields[key].value ?? 'No confirmado'}</td><td>{extraction.fields[key].evidence ?? 'Sin evidencia'}</td></tr>)}</tbody></table></div>
      {extraction.warnings.length>0 && <section className={styles.section}><h2>Datos por revisar</h2><ul>{extraction.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul></section>}
      <p className={styles.note}>Compara cada dato con el original. Las citas también son generadas por IA y pueden contener errores. Los valores propuestos se conservan como evidencia; las correcciones se guardan por separado al confirmar.</p>
    </> : <><p>No hay una extracción validada disponible. Si el proceso se interrumpió, espera tres minutos y reintenta.</p>{membership.data && ['admin','operator'].includes(membership.data.role) && !['authorized','paid_simulated','cancelled'].includes(invoice.status) && invoice.extraction_attempts<3 && invoice.extraction_state!=='completed' && <RetryButton id={id}/>}</>}
    {invoice.supplier_id && <section className={styles.section}><h2>Datos confirmados</h2><dl className={styles.confirmed}><dt>Factura</dt><dd>{invoice.invoice_number}</dd><dt>Proveedor</dt><dd>{supplierOptions.find(s=>s.id===invoice.supplier_id)?.name??'Proveedor registrado'}</dd><dt>Acuerdo</dt><dd>{agreementOptions.find(a=>a.id===invoice.agreement_id)?.reference??'Sin acuerdo confirmado'}</dd><dt>Importe</dt><dd>{invoice.currency} {invoice.amount}</dd><dt>Emisión / vencimiento</dt><dd>{invoice.issue_date} / {invoice.due_date}</dd></dl></section>}
    {invoice.status==='paid_simulated' && <section className={styles.section}><p className={styles.eyebrow}>COMPROBANTE DE SIMULACIÓN</p><h2>Pago simulado completado</h2>{payments.error || !payments.data[0]?<p className={styles.error}>No se pudo consultar el movimiento. No ejecutes otro pago; recarga para comprobarlo.</p>:<><p className={styles.description}>Importe debitado: <strong>{payments.data[0].currency} {payments.data[0].amount}</strong>.</p><p className={styles.note}>Movimiento: {payments.data[0].id} · Fecha: {new Date(payments.data[0].created_at).toLocaleString('es-CO',{timeZone:'America/Bogota'})} (Colombia).</p><p>El pago original consumió la reserva y registró el gasto. Los reembolsos recibidos se muestran por separado. Es un comprobante de simulación, sin transferencia bancaria real.</p></>}<Link className={styles.back} href={`/dashboard?company=${invoice.company_id}`}>Ver saldos actualizados →</Link></section>}
    {invoice.status==='paid_simulated' && <section className={styles.section}><h2>Devoluciones recibidas</h2>{!refundsSummary?<p className={styles.error}>No se pudo verificar el saldo reembolsable. No registres otra devolución hasta consultar el historial completo.</p>:<><p>Pago original: {payments.data?.[0]?.currency} {refundsSummary.paid} · Total devuelto: {refundsSummary.refunded} · Máximo aún reembolsable: {refundsSummary.remaining}.</p>{refundsSummary.remaining==='0.00'&&<p className={styles.description}>Reembolso total registrado. El pago original se conserva para auditoría; no se permiten más devoluciones sobre él.</p>}<div className={styles.tableWrap}><table><thead><tr><th>Importe devuelto</th><th>Motivo registrado</th><th>Fecha Colombia</th></tr></thead><tbody>{refunds.data?.map(r=><tr key={r.id}><td>{r.currency} {r.amount}</td><td>{r.description}</td><td>{new Date(r.created_at).toLocaleString('es-CO',{timeZone:'America/Bogota'})}</td></tr>)}</tbody></table></div></>}</section>}
    {invoice.status==='paid_simulated' && refundsSummary && refundsSummary.remaining!=='0.00' && !membership.error && membership.data && ['admin','approver'].includes(membership.data.role) && <RefundForm key={refundsSummary.remaining} id={id} currency={payments.data![0].currency} remaining={refundsSummary.remaining}/>}
    {invoice.status==='cancelled' && <p className={styles.description}>Factura cancelada definitivamente. La operación libera cualquier reserva activa; no debita la wallet ni ejecuta un reembolso.</p>}
    {decisions.error || reservations.error ? <p className={styles.error}>No se pudo consultar la decisión o sus reservas. Recarga antes de continuar.</p> : decisions.data[0] && <DecisionPanel decision={decisions.data[0] as DecisionView} version={invoice.version} reservation={(reservations.data[0] as ReservationView|undefined)??null} invoiceStatus={invoice.status} company={invoice.company_id}/>}
    {extraction && canReview && (suppliers.error || agreements.error || decisions.error || reservations.error ? <p className={styles.error}>No se puede confirmar hasta cargar proveedores, acuerdos y estado actual.</p> : <ReviewForm key={invoice.version} id={id} version={invoice.version} initial={initial} suppliers={supplierOptions} agreements={agreementOptions}/>)}
    {membership.error || decisions.error || reservations.error || payments.error ? <p className={styles.error}>No se pueden habilitar acciones hasta consultar permisos y estado actual. Recarga.</p> : membership.data && <FinancialActions key={`${invoice.status}-${decisions.data[0]?.id??'none'}`} id={id} status={invoice.status} role={membership.data.role} decisionId={decisions.data[0]?.status==='pending_approval' && decisions.data[0].invoice_version===invoice.version?decisions.data[0].id:null}/>}
    {approvals.error ? <p className={styles.error}>No se pudo consultar el historial de aprobaciones.</p> : approvals.data.length>0 && <section className={styles.section}><h2>Aprobaciones y rechazos</h2><ul>{approvals.data.map(a=><li key={a.id}><strong>{a.action==='approve'?'Aprobada':'Rechazada'}</strong>: {a.reason} · {new Date(a.created_at).toLocaleString('es-CO',{timeZone:'America/Bogota'})} (Colombia).</li>)}</ul></section>}
    {audit.error ? <p className={styles.error}>No se pudo cargar la auditoría.</p> : <section className={styles.section}><h2>Últimos eventos</h2><ol>{audit.data.map(event=><li key={event.id}>{event.event_type} · {new Date(event.created_at).toLocaleString('es-CO',{timeZone:'America/Bogota'})} (Colombia)<span className={styles.note}> · Actor: {event.actor_id??'Proceso de extracción'}</span></li>)}</ol></section>}
    <p className={styles.note}>SHA-256: {doc.data?.sha256}</p>
    <p className={styles.note}>La extracción no modifica saldos. La autorización reserva fondos; el pago simulado los debita; la cancelación libera reservas y el reembolso recibido acredita la wallet y revierte gasto del presupuesto original. Todas estas acciones quedan registradas.</p>
  </main>;
}
