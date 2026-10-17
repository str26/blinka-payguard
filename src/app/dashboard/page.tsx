import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { signOut } from '../login/actions';
import styles from '../workspace.module.css';
export const dynamic = 'force-dynamic';
function money(value: string | number, currency: string) {
  // Display only. All monetary decisions and arithmetic run in PostgreSQL.
  const [whole, decimals = ''] = String(value).split('.');
  return `${currency} ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${decimals.padEnd(2,'0')}`;
}
function CloseSession() { return <form action={signOut}><button className={styles.secondary}>Cerrar sesión</button></form>; }
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ company?: string }> }) {
  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) redirect('/login');
  const { data: memberships, error: membershipError } = await supabase.from('company_members').select('company_id,role').eq('user_id',user.id).order('company_id');
  if (membershipError) return <main className={styles.workspace}><h1 className={styles.title}>No se pudo consultar el acceso</h1><p>Comprueba que la migración y sus permisos estén aplicados. Vuelve a cargar para reintentar.</p><CloseSession /></main>;
  if (!memberships?.length) return <main className={styles.workspace}><h1 className={styles.title}>Tu cuenta aún no tiene empresa asignada</h1><p>La sesión funciona. El administrador debe asociar este usuario a la empresa ficticia.</p><p className={styles.note}>Usuario Auth: <code>{user.id}</code></p><CloseSession /></main>;
  const { company: requested } = await searchParams;
  const selected = requested ? memberships.find(m => m.company_id===requested) : memberships[0];
  if (!selected) return <main className={styles.workspace}><h1 className={styles.title}>Empresa no disponible</h1><a className={styles.back} href="/dashboard">Volver a mis empresas</a><CloseSession /></main>;
  const [company, wallets, policies, budgets] = await Promise.all([
    supabase.from('companies').select('id,name,agent_enabled').eq('id',selected.company_id).single(),
    supabase.from('wallets').select('currency,balance::text,reserved::text,available::text').eq('company_id',selected.company_id).order('currency'),
    supabase.from('policies').select('currency,version,automatic_limit::text,absolute_limit::text').eq('company_id',selected.company_id).eq('active',true).order('currency'),
    supabase.from('budgets').select('currency,period,total::text,reserved::text,spent::text,available::text').eq('company_id',selected.company_id).order('period',{ascending:false}).order('currency'),
  ]);
  if (company.error || wallets.error || policies.error || budgets.error) return <main className={styles.workspace}><h1 className={styles.title}>No se pudieron cargar los datos</h1><p>Revisa las migraciones y los permisos de lectura. No se muestran saldos inventados.</p><CloseSession /></main>;
  return <main className={styles.workspace}>
    <header className={styles.header}><div><p className={styles.eyebrow}>PAYGUARD · SIMULACIÓN</p><h1 className={styles.title}>{company.data.name}</h1><p className={styles.description}>{user.email} · Rol: {selected.role} · Agente: {company.data.agent_enabled?'habilitado':'sin habilitar'}</p></div><CloseSession /></header>
    {memberships.length>1 && <form method="get" className={styles.switcher}><label htmlFor="company">Empresa</label><select id="company" name="company" defaultValue={selected.company_id}>{memberships.map(m=><option key={m.company_id} value={m.company_id}>{m.company_id}</option>)}</select><button className={styles.secondary}>Cambiar</button></form>}
    <p><Link className={styles.back} href={`/invoices?company=${selected.company_id}`}>Subir y revisar facturas →</Link></p>
    <section className={styles.cards} aria-label="Wallets">{wallets.data.map(w=><div className={styles.card} key={w.currency}><p className={styles.eyebrow}>WALLET {w.currency}</p><h2>{money(w.available,w.currency)}</h2><p>Disponible</p><dl><dt>Saldo contable</dt><dd>{money(w.balance,w.currency)}</dd><dt>Reservado</dt><dd>{money(w.reserved,w.currency)}</dd></dl></div>)}</section>
    {!wallets.data.length && <p>No hay wallets configuradas para esta empresa.</p>}
    <section className={styles.section}><h2>Políticas activas</h2><div className={styles.tableWrap}><table><thead><tr><th>Moneda</th><th>Versión</th><th>Hasta autorización automática</th><th>Límite absoluto</th></tr></thead><tbody>{policies.data.map(p=><tr key={p.currency}><td>{p.currency}</td><td>{p.version}</td><td>{money(p.automatic_limit,p.currency)}</td><td>{money(p.absolute_limit,p.currency)}</td></tr>)}</tbody></table></div>{!policies.data.length && <p>No hay políticas activas.</p>}</section>
    <section className={styles.section}><h2>Presupuestos por periodo</h2><div className={styles.tableWrap}><table><thead><tr><th>Periodo</th><th>Moneda</th><th>Total</th><th>Reservado</th><th>Consumido</th><th>Disponible</th></tr></thead><tbody>{budgets.data.map(b=><tr key={`${b.period}-${b.currency}`}><td>{b.period}</td><td>{b.currency}</td><td>{money(b.total,b.currency)}</td><td>{money(b.reserved,b.currency)}</td><td>{money(b.spent,b.currency)}</td><td>{money(b.available,b.currency)}</td></tr>)}</tbody></table></div></section>
    <p className={styles.note}>Datos consultados en Supabase con tu sesión. La carga de facturas está disponible. El agente habilitado procesa las facturas y paga automáticamente cuando cumplen la política. Las excepciones se revisan según tu rol.</p>
  </main>;
}
