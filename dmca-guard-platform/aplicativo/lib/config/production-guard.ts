import { NextRequest, NextResponse } from 'next/server';

/**
 * Production Guard Middleware
 * Blocks test/development routes in production
 */

const BLOCKED_ROUTES_IN_PRODUCTION = [
  '/test',
  '/api/test-websocket',
  '/api/example-rate-limited',
  '/api/example-with-api-response',
  '/api/debug',
  '/api/mock'
];

export function isBlockedInProduction(pathname: string): boolean {
  if (process.env.NODE_ENV !== 'production') {
    return false;
  }
  
  return BLOCKED_ROUTES_IN_PRODUCTION.some(route => 
    pathname.startsWith(route)
  );
}

export function productionGuardResponse(): NextResponse {
  return NextResponse.json(
    { 
      error: 'Not Found',
      message: 'This endpoint is not available in production'
    },
    { status: 404 }
  );
}