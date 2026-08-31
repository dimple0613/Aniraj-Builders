import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET;

export default async function middleware(request: NextRequest) {
    const pathname = request.nextUrl.pathname;

    if (
        pathname.startsWith('/_next') ||
        pathname.startsWith('/_static') ||
        pathname.startsWith('/favicon') ||
        pathname.includes('.') ||
        pathname === '/login' ||
        pathname === '/forgot-password' ||
        pathname.startsWith('/reset-password') ||
        pathname.match(/^\/[^/]+\/vardhi\/add/) ||
        pathname.match(/^\/[^/]+\/vardhi\/success/)
    ) {
        return NextResponse.next();
    }

    const token = await getToken({ req: request, secret: NEXTAUTH_SECRET });
    const isLoggedIn = !!token;

    if (pathname === '/') {
        if (isLoggedIn) {
            return NextResponse.redirect(new URL('/dashboard', request.nextUrl));
        }
        return NextResponse.redirect(new URL('/login', request.nextUrl));
    }

    if (!isLoggedIn) {
        const loginUrl = new URL('/login', request.nextUrl);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
    }

    const requestHeaders = new Headers(request.headers);

    if (token?.company_id) {
        requestHeaders.set('x-company-id', token.company_id as string);
    }

    return NextResponse.next({
        request: {
            headers: requestHeaders,
        },
    });
}

export const config = {
    matcher: [
        '/((?!_next/|_static/|_vercel|api/auth|login|forgot-password|reset-password|.*\\.).*)',
    ],
};
