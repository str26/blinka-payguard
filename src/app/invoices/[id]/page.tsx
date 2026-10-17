import { redirect,notFound } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { fieldLabels,fieldNames,validateExtraction } from '@/modules/invoices/domain/extraction';
import { extractionMessages } from '@/modules/invoices/server/gemini';
import { UUID } from '@/modules/invoices/server/access';
import RetryButton from './retry-button';
import styles from '../../workspace.module.css';
export const dynamic='force-dynamic';
export default async function Invoice({params}:{params:Promise<{id:string}>}) {
  const {id}=await params;if(!UUID.test(id))notFound();
  const client=await createSupabaseServerClient();const {data:{user},error}=await client.auth.getUser();
  if(error || !user)redirect('/login');
  const result=await client.from('invoices').select('id,company_id,status,extraction_state,extraction_attempts,extraction_error,extracted_data,document_id').eq('id',id).maybeSingle();
  if(result.error)return <main className={styles.workspace}><h1>No se pudo cargar la factura</h1><p>Verifica las migraciones y vuelve a intentar.</p></main>;
  if(!result.data)notFound();const invoice=result.data;
  const [doc,membership]=await Promise.all([
    client.from('documents').select('original_name,sha256').eq('id',invoice.document_id).single(),
    client.from('company_members').select('role').eq('company_id',invoice.company_id).eq('user_id',user.id).single(),
  ]);
  let extraction=null;
  if(invoice.extraction_state==='completed') {try{extraction=validateExtraction(invoice.extracted_data);}catch{/* Corrupt data is never displayed as verified. */}}
  return <main className={styles.workspace}>
    <Link className={styles.back} href={`/invoices?company=${invoice.company_id}`}>← Facturas</Link>
    <p className={styles.eyebrow}>EXTRACCIÓN · REVISIÓN PENDIENTE</p><h1 className={styles.title}>{doc.data?.original_name ?? 'Factura'}</h1>
    <p>Extracción: <strong>{invoice.extraction_state}</strong> · Intentos: {invoice.extraction_attempts}/3 · Estado: {invoice.status}</p>
    <p><a className={styles.back} href={`/api/invoices/${id}/document`} target="_blank" rel="noopener noreferrer">Abrir documento original ↗</a></p>
    {invoice.extraction_error && <p className={styles.error}>{extractionMessages[invoice.extraction_error] ?? 'No se pudo completar la extracción.'}</p>}
    {extraction ? <>
      <div className={styles.tableWrap}><table><thead><tr><th>Campo</th><th>Valor propuesto</th><th>Evidencia citada por Gemini</th></tr></thead><tbody>{fieldNames.map(key=><tr key={key}><th>{fieldLabels[key]}</th><td>{extraction.fields[key].value ?? 'No confirmado'}</td><td>{extraction.fields[key].evidence ?? 'Sin evidencia'}</td></tr>)}</tbody></table></div>
      {extraction.warnings.length>0 && <section className={styles.section}><h2>Datos por revisar</h2><ul>{extraction.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul></section>}
      <p className={styles.note}>Compara cada dato con el original. Las citas también son generadas por IA y pueden contener errores. Esta entrega muestra la propuesta; la edición, confirmación y evaluación de reglas se conectan en el siguiente paso.</p>
    </> : <><p>No hay una extracción validada disponible. Si el proceso se interrumpió, espera tres minutos y reintenta.</p>{membership.data && ['admin','operator'].includes(membership.data.role) && invoice.extraction_attempts<3 && invoice.extraction_state!=='completed' && <RetryButton id={id}/>}</>}
    <p className={styles.note}>SHA-256: {doc.data?.sha256}</p>
    <p className={styles.note}>No se modificaron wallets ni presupuestos. No se ejecutaron pagos.</p>
  </main>;
}
