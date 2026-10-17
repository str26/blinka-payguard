import {getI18n} from '@/lib/i18n/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import UploadForm from './upload-form';
import InvoiceTable from '@/components/invoice-table';
import styles from '../workspace.module.css';
export const dynamic='force-dynamic';
export default async function Invoices({searchParams}:{searchParams:Promise<{company?:string}>}) {
 const {t,locale}=await getI18n();

  const client=await createSupabaseServerClient();const {data:{user},error}=await client.auth.getUser();
  if(error || !user) redirect('/login');
  const memberships=await client.from('company_members').select('company_id,role').eq('user_id',user.id).order('company_id');
  if(memberships.error) return <main className={styles.workspace}><h1>{t("No se pudo verificar tu acceso")}</h1><Link href="/dashboard">{t("Volver")}</Link></main>;
  const requested=(await searchParams).company;
  const selected=requested?memberships.data.find(m=>m.company_id===requested):memberships.data[0];
  if(!selected) return <main className={styles.workspace}><h1>{t("Empresa no disponible")}</h1><Link href="/dashboard">{t("Volver")}</Link></main>;
  const invoices=await client.from('invoices').select('id,status,invoice_number,currency,amount::text,extraction_state,created_at,documents(original_name)').eq('company_id',selected.company_id).order('created_at',{ascending:false}).limit(30);
  return <main className={styles.workspace}>
    <Link className={styles.back} href={`/dashboard?company=${selected.company_id}`}>{t("← Panel")}</Link>
    <p className={styles.eyebrow}>{t("PAYGUARD · FACTURAS DE PRUEBA")}</p><h1 className={styles.title}>{t("Tus facturas, en un solo lugar.")}</h1>
    <p className={styles.description}>{t("El archivo se enviará a Gemini para extraer sus datos. Usa facturas ficticias para esta demo. El agente valida la extracción con las reglas de la empresa y puede ejecutar el pago simulado automáticamente. Las excepciones requieren intervención humana.")}</p>
    {['admin','operator'].includes(selected.role)?<section id="upload" className={styles.uploadPanel}><h2>{t("Cargar y activar el agente")}</h2><p className={styles.note}>{t("Un documento. Una evaluación. El agente ejecuta el pago simulado si cumple las reglas.")}</p><UploadForm company={selected.company_id}/></section>:<p>{t("Tu rol permite consultar. La carga corresponde al administrador u operador.")}</p>}
    <section className={styles.section}><h2>{t("Últimas 30 facturas")}</h2>
      {invoices.error?<p className={styles.error}>{t("No se pudieron cargar las facturas. Verifica que esté aplicada la migración 003.")}</p>:
      <InvoiceTable invoices={invoices.data} company={selected.company_id}/>}
    </section>
  </main>;
}
