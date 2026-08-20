import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSession } from '@/lib/auth';

const PROTECTED_PATHS = [
  '/dashboard',
  '/invoices',
  '/bills',
  '/expenses',
  '/inventory',
  '/assets',
  '/reports',
  '/settings',
  '/customers',
  '/vendors',
  '/journal',
  '/accounts',
];

const AUTH_PATHS = ['/login', '/signup', '/forgot-password'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Block signup page if signups are disabled
  if (pathname.startsWith('/signup') && process.env.NEXT_PUBLIC_SIGNUPS_ENABLED !== 'true') {
    const url = new URL('/login', req.url);
    url.searchParams.set('signup', 'disabled');
    return NextResponse.redirect(url);
  }

  const cookieHeader = req.headers.get('cookie') ?? '';
  const user = await getSession(cookieHeader);

  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  // Unauthenticated user hitting a protected route → login
  if (isProtected && !user) {
    const url = new URL('/login', req.url);
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  // Authenticated user hitting auth pages → dashboard
  if (isAuthPage && user) {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
