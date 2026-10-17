import LanguageControl from '@/components/language-control';
import {getI18n} from '@/lib/i18n/server';
import Link from 'next/link';
import Brand from '@/components/brand';
import ThemeControl from '@/components/theme-control';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { LoginForm } from './login-form';
import styles from '../workspace.module.css';
export const dynamic = 'force-dynamic';
export default async function LoginPage() {
 const {t,locale}=await getI18n();

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect('/dashboard');
  return <><header className="pg-login-head"><Brand/><LanguageControl/><ThemeControl/></header><main className={styles.login}>
    <Link href="/" className={styles.back}>{t("← PayGuard")}</Link>
    <p className={styles.eyebrow}>{t("ENTORNO DE DEMOSTRACIÓN")}</p>
    <h1 className={styles.title}>{t("Acceso al equipo")}</h1>
    <p className={styles.description}>{t("Ingresa con el usuario de la aplicación que te asignó el administrador.")}</p>
    <LoginForm />
    <p className={styles.note}>{t("El acceso a la organización de Supabase es independiente de esta cuenta. Sin dinero real.")}</p>
  </main></>;
}
