import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signOut } from '../login/actions';
import styles from '../workspace.module.css';
import DashboardView,{type DashboardData} from '@/components/dashboard-view';
export const dynamic = 'force-dynamic';
function money(value: string | number, currency: string) {
  // Display only. All monetary decisions and arithmetic run in PostgreSQL.
  const [whole, decimals = ''] = String(value).split('.');
  return `${currency} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimals.padEnd(2,'0')}`;
}
function CloseSession() { return <form action={signOut}><button className={styles.secondary}>Cerrar sesión</button></form>; }
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ company?: string;view?:string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');
  const { data: memberships, error: membershipError } = await supabase.from('company_members').select('company_id,role').eq('user_id',user.id).order('company_id');
  if (membershipError) return <main className={styles.workspace}><h1 className={styles.title}>No se pudo consultar el acceso</h1><p>Comprueba que la migración y sus permisos estén aplicados. Vuelve a cargar para reintentar.</p><CloseSession /></main>;
  if (!memberships?.length) return <main className={styles.workspace}><h1 className={styles.title}>Tu cuenta aún no tiene empresa asignada</h1><p>La sesión funciona. El administrador debe asociar este usuario a la empresa ficticia.</p><p className={styles.note}>Usuario Auth: <code>{user.id}</code></p><CloseSession /></main>;
  const { company: requested,view } = await searchParams;
  const selected = requested ? memberships.find(m => m.company_id===requested) : memberships[0];
  if (!selected) return <main className={styles.workspace}><h1 className={styles.title}>Empresa no disponible</h1><a className={styles.back} href="/dashboard">Volver a mis empresas</a><CloseSession /></main>;
  const [company, wallets, policies, budgets, invoices, suppliers, agreements, audit] = await Promise.all([
    supabase.from('companies').select('id,name,agent_enabled').eq('id',selected.company_id).single(),
    supabase.from('wallets').select('currency,balance::text,reserved::text,available::text').eq('company_id',selected.company_id).order('currency'),
    supabase.from('policies').select('currency,version,automatic_limit::text,absolute_limit::text').eq('company_id',selected.company_id).eq('active',true).order('currency'),
    supabase.from('budgets').select('currency,period,total::text,reserved::text,spent::text,available::text').eq('company_id',selected.company_id).order('period',{ascending:false}).order('currency'),
    supabase.from('invoices').select('id,status,invoice_number,supplier_id,currency,amount::text,due_date,extraction_state,created_at,documents(original_name)').eq('company_id',selected.company_id).order('created_at',{ascending:false}).limit(100),
    supabase.from('suppliers').select('id,name,code,allowed').eq('company_id',selected.company_id).order('name'),
    supabase.from('agreements').select('id,supplier_id,reference,currency,amount::text').eq('company_id',selected.company_id).order('reference'),
    supabase.from('audit_events').select('id,event_type,actor_id,created_at,entity_id').eq('company_id',selected.company_id).order('created_at',{ascending:false}).limit(30),
  ]);
  if (company.error || wallets.error || policies.error || budgets.error) return <main className={styles.workspace}><h1 className={styles.title}>No se pudieron cargar los datos</h1><p>Revisa las migraciones y los permisos de lectura. No se muestran saldos inventados.</p><CloseSession /></main>;
  const dateParts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Bogota',year:'numeric',month:'2-digit'}).formatToParts(new Date());
  const period=`${dateParts.find(p=>p.type==='year')!.value}-${dateParts.find(p=>p.type==='month')!.value}-01`;
  const operationError=!!(invoices.error||suppliers.error||agreements.error||audit.error);
  const data={company:company.data,email:user.email??'',role:selected.role,period,wallets:wallets.data,budgets:budgets.data,policies:policies.data,
    invoices:invoices.data??[],suppliers:suppliers.data??[],agreements:agreements.data??[],audit:audit.data??[],view:view??'summary',operationError} as DashboardData;
  return <>{memberships.length>1&&<form method="get" className={styles.switcher} style={{padding:'12px 32px'}}><label htmlFor="company">Empresa</label><select id="company" name="company" defaultValue={selected.company_id}>{memberships.map(m=><option key={m.company_id} value={m.company_id}>{m.company_id}</option>)}</select><button className={styles.secondary}>Cambiar</button></form>}<DashboardView data={data}/></>;
}
