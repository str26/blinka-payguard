'use client';
import {useI18n} from '@/lib/i18n/provider';

import { useActionState } from 'react';
import { signIn } from './actions';
import styles from '../workspace.module.css';
export function LoginForm() {
 const {t,locale}=useI18n();

  const [state, action, pending] = useActionState(signIn, { error: '' });
  return <form action={action} className={styles.form}>
    <label htmlFor="email">{t("Correo electrónico")}</label>
    <input id="email" name="email" type="email" autoComplete="username" required maxLength={254} />
    <label htmlFor="password">{t("Contraseña")}</label>
    <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} />
    {state.error && <p className={styles.error} role="alert">{t(state.error)}</p>}
    <button className={styles.button} disabled={pending} type="submit">{t(pending ? 'Ingresando…' : 'Iniciar sesión')}</button>
  </form>;
}
