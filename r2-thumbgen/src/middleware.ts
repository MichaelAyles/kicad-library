import { NextRequest, NextResponse } from 'next/server';

/**
 * Middleware to handle requests for .kicad_sch files
 * Returns empty schematic stubs for hierarchical sheet references that don't exist
 */
export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  // Check if this is a request for a .kicad_sch file at the root level
  // These are typically hierarchical sheet references that KiCanvas is trying to load
  if (path.endsWith('.kicad_sch') && !path.startsWith('/api/')) {
    console.log(`[Middleware] Intercepting root .kicad_sch request: ${path}`);

    // Return an empty schematic stub
    const emptySchematic = `(kicad_sch (version 20230121) (generator "CircuitSnips")
  (uuid 00000000-0000-0000-0000-000000000000)
  (paper "A4")
  (title_block
    (title "Sheet Not Found")
    (comment 1 "This hierarchical sheet is not available")
  )
)`;

    return new NextResponse(emptySchematic, {
      status: 200,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match any .kicad_sch file at root level
    '/:filename*.kicad_sch',
  ],
};
