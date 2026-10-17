import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseConfig } from './lib/supabase/config';

export async function proxy(request: NextRequest) {
  // A fresh client per request prevents sessions being shared between users.
  let response = NextResponse.next({ request });
  const { url, key } = getSupabaseConfig();
  const supabase = createServerClient(url, key, {
    cookieOptions: { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/' },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const { name, value } of values) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of values) response.cookies.set(name, value, options);
      },
    },
  });
  // Identity is independently verified in each protected page/action as well.
  await supabase.auth.getUser();
  response.headers.set('Cache-Control', 'private, no-store');
  return response;
}
export const config = { matcher: ['/login', '/dashboard/:path*', '/invoices/:path*', '/api/invoices/:path*'] };
