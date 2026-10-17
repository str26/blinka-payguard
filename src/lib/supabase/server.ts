import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getSupabaseConfig } from './config';

export async function createSupabaseServerClient() {
  const store = await cookies();
  const { url, key } = getSupabaseConfig();
  return createServerClient(url, key, {
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' },
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try { for (const { name, value, options } of values) store.set(name, value, options); }
        catch { /* Server Components cannot write cookies; proxy refreshes before rendering. */ }
      },
    },
  });
}
