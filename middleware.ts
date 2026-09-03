import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rutas públicas que no requieren sesión
const PUBLICAS = ['/login', '/registro'];

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: ()   => request.cookies.getAll(),
        setAll: (cs) => cs.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)),
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  const esPublica = PUBLICAS.some((p) => pathname === p || pathname.startsWith(p + '/'));

  // Sin sesión y ruta protegida → login
  if (!user && !esPublica) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Con sesión y va al login o registro → POS
  if (user && esPublica) {
    return NextResponse.redirect(new URL('/pos', request.url));
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
