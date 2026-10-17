import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import UploadForm from './upload-form';
import styles from '../workspace.module.css';
export const dynamic='force-dynamic';
export default async function Invoices({searchParams}:{searchParams:Promise<{company?:string}>}) {
  const client=await createSupabaseServerClient();const {data:{user},error}=await client.auth.getUser();
  if(error || !user) redirect('/login');
  const memberships=await client.from('company_members').select('company_id,role').eq('user_id',user.id).order('company_id');
  if(memberships.error) return <main className={styles.workspace}><h1>No se pudo verificar tu acceso</h1><Link href="/dashboard">Volver</Link></main>;
  const requested=(await searchParams).company;
  const selected=requested?memberships.data.find(m=>m.company_id===requested):memberships.data[0];
  if(!selected) return <main className={styles.workspace}><h1>Empresa no disponible</h1><Link href="/dashboard">Volver</Link></main>;
  const invoices=await client.from('invoices').select('id,status,extraction_state,created_at,documents(original_name)').eq('company_id',selected.company_id).order('created_at',{ascending:false}).limit(30);
  return <main className={styles.workspace}>
    <Link className={styles.back} href={`/dashboard?company=${selected.company_id}`}>← Panel</Link>
    <p className={styles.eyebrow}>PAYGUARD · FACTURAS DE PRUEBA</p><h1 className={styles.title}>De documento a datos verificables</h1>
    <p className={styles.description}>El archivo se enviará a Gemini para extraer sus datos. Usa facturas ficticias para esta demo. El agente valida la extracción con las reglas de la empresa y puede ejecutar el pago simulado automáticamente. Las excepciones requieren intervención humana.</p>
    {['admin','operator'].includes(selected.role)?<UploadForm company={selected.company_id}/>:<p>Tu rol permite consultar. La carga corresponde al administrador u operador.</p>}
    <section className={styles.section}><h2>Últimas 30 facturas</h2>
      {invoices.error?<p className={styles.error}>No se pudieron cargar las facturas. Verifica que esté aplicada la migración 003.</p>:
      <div className={styles.tableWrap}><table><thead><tr><th>Archivo</th><th>Extracción</th><th>Estado</th><th>Detalle</th></tr></thead><tbody>{invoices.data.map(invoice=>{
        const doc=invoice.documents as unknown as {original_name:string}|null;
        return <tr key={invoice.id}><td>{doc?.original_name ?? 'Factura'}</td><td>{invoice.extraction_state}</td><td>{invoice.status}</td><td><Link className={styles.back} href={`/invoices/${invoice.id}`}>Revisar</Link></td></tr>;
      })}</tbody></table>{!invoices.data.length && <p>Aún no hay facturas.</p>}</div>}
    </section>
  </main>;
}
