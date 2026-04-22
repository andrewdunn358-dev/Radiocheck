import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;
  
  // Don't rewrite for static files and API routes
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/images') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Handle subdomain routing
  if (hostname.startsWith('admin.')) {
    // admin.radiocheck.me -> /admin
    if (!pathname.startsWith('/admin')) {
      const url = request.nextUrl.clone();
      url.pathname = `/admin${pathname}`;
      return NextResponse.rewrite(url);
    }
  }
  
  if (hostname.startsWith('staff.')) {
    // staff.radiocheck.me -> /staff
    if (!pathname.startsWith('/staff')) {
      const url = request.nextUrl.clone();
      url.pathname = `/staff${pathname}`;
      return NextResponse.rewrite(url);
    }
  }
  
  if (hostname.startsWith('training.')) {
    // training.radiocheck.me -> /learning
    if (!pathname.startsWith('/learning')) {
      const url = request.nextUrl.clone();
      url.pathname = `/learning${pathname}`;
      return NextResponse.rewrite(url);
    }
  }
  
  if (hostname.startsWith('lms-admin.')) {
    // lms-admin.radiocheck.me -> /lms-admin
    if (!pathname.startsWith('/lms-admin')) {
      const url = request.nextUrl.clone();
      url.pathname = `/lms-admin${pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  if (hostname.startsWith('police.')) {
    // police.radiocheck.me -> Blue Light Support portal on Render backend
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'https://veterans-support-api.onrender.com';
    if (pathname.startsWith('/api/')) {
      // Pass API calls through to backend
      return NextResponse.rewrite(new URL(`${apiBase}${pathname}`, request.url));
    }
    // Everything else -> bluelight portal
    return NextResponse.rewrite(new URL(`${apiBase}/api/bluelight-portal`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
