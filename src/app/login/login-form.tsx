'use client';
import { useActionState } from 'react';
import { signIn } from './actions';
import styles from '../workspace.module.css';
export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, { error: '' });
  return <form action={action} className={styles.form}>
    <label htmlFor="email">Correo electrónico</label>
    <input id="email" name="email" type="email" autoComplete="username" required maxLength={254} />
    <label htmlFor="password">Contraseña</label>
    <input id="password" name="password" type="password" autoComplete="current-password" required maxLength={1024} />
    {state.error && <p className={styles.error} role="alert">{state.error}</p>}
    <button className={styles.button} disabled={pending} type="submit">{pending ? 'Ingresando…' : 'Iniciar sesión'}</button>
  </form>;
}
