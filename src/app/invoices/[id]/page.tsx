import { redirect,notFound } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fieldLabels,fieldNames,validateExtraction } from '@/modules/invoices/domain/extraction';
import { extractionMessages } from '@/modules/invoices/server/gemini';
import { UUID } from '@/modules/invoices/server/access';
import { statusLabels } from '@/modules/invoices/domain/review';
import ReviewForm, { type SupplierOption, type AgreementOption } from './review-form';
import DecisionPanel, { type DecisionView, type ReservationView } from './decision-panel';
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
  const [doc,membership,suppliers,agreements,decisions,reservations]=await Promise.all([
    client.from('documents').select('original_name,sha256').eq('id',invoice.document_id).single(),
    client.from('company_members').select('role').eq('company_id',invoice.company_id).eq('user_id',user.id).single(),
    client.from('suppliers').select('id,code,name,allowed').eq('company_id',invoice.company_id).order('name'),
    client.from('agreements').select('id,supplier_id,reference,currency,amount::text').eq('company_id',invoice.company_id).order('reference'),
    client.from('decisions').select('id,status,invoice_version,checks,input_snapshot,created_at,policy_currency:input_snapshot->policy->>currency,policy_version:input_snapshot->policy->>version,automatic_limit:input_snapshot->policy->>automatic_limit,absolute_limit:input_snapshot->policy->>absolute_limit').eq('invoice_id',id).order('decision_order',{ascending:false}).limit(1),
    client.from('reservations').select('currency,amount::text,status').eq('invoice_id',id).eq('status','active').limit(1),
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
    </> : <><p>No hay una extracción validada disponible. Si el proceso se interrumpió, espera tres minutos y reintenta.</p>{membership.data && ['admin','operator'].includes(membership.data.role) && invoice.extraction_attempts<3 && invoice.extraction_state!=='completed' && <RetryButton id={id}/>}</>}
    {decisions.error || reservations.error ? <p className={styles.error}>No se pudo consultar la decisión o sus reservas. Recarga antes de continuar.</p> : decisions.data[0] && <DecisionPanel decision={decisions.data[0] as DecisionView} version={invoice.version} reservation={(reservations.data[0] as ReservationView|undefined)??null}/>}
    {extraction && canReview && (suppliers.error || agreements.error || decisions.error || reservations.error ? <p className={styles.error}>No se puede confirmar hasta cargar proveedores, acuerdos y estado actual.</p> : <ReviewForm key={invoice.version} id={id} version={invoice.version} initial={initial} suppliers={supplierOptions} agreements={agreementOptions}/>)}
    {invoice.status==='authorized' && <p className={styles.note}>La autorización protege estos datos de cambios. La aprobación, cancelación y el pago simulado se conectarán en la siguiente entrega.</p>}
    <p className={styles.note}>SHA-256: {doc.data?.sha256}</p>
    <p className={styles.note}>La extracción no modifica saldos. La confirmación puede reservar fondos si las reglas autorizan; esta pantalla aún no ejecuta pagos.</p>
  </main>;
}
