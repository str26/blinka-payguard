import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LoginForm } from './login-form';
import styles from '../workspace.module.css';
export const dynamic = 'force-dynamic';
export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');
  return <main className={styles.login}>
    <Link href="/" className={styles.back}>← PayGuard</Link>
    <p className={styles.eyebrow}>ENTORNO DE DEMOSTRACIÓN</p>
    <h1 className={styles.title}>Acceso al equipo</h1>
    <p className={styles.description}>Ingresa con el usuario de la aplicación que te asignó el administrador.</p>
    <LoginForm />
    <p className={styles.note}>El acceso a la organización de Supabase es independiente de esta cuenta. Sin dinero real.</p>
  </main>;
}
