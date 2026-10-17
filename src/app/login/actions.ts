'use server';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
export type LoginState = { error: string };
export async function signIn(_previous: LoginState, form: FormData): Promise<LoginState> {
  const email = form.get('email');
  const password = form.get('password');
  if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > 1024 || !email.trim() || !password) {
    return { error: 'Introduce un correo y una contraseña válidos.' };
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) return { error: 'No se pudo iniciar sesión. Revisa tus credenciales y la confirmación del correo.' };
  } catch {
    return { error: 'No se pudo conectar con el servicio de acceso. Inténtalo de nuevo.' };
  }
  redirect('/dashboard');
}
export async function signOut() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut({ scope: 'local' });
  if (error) throw new Error('No se pudo cerrar la sesión. Inténtalo de nuevo.');
  redirect('/login');
}
