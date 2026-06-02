import { NextResponse } from 'next/server';

const frontendOrigin = process.env.FRONTEND_ORIGIN?.trim() || 'http://localhost:3000';

const corsHeaders = {
  'Access-Control-Allow-Origin': frontendOrigin === '*' ? 'http://localhost:3000' : frontendOrigin,
  'Access-Control-Allow-Methods': 'GET,POST,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Credentials': 'true',
};

export function jsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);

  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }

  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

export function optionsResponse() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export function noContentResponse() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export function unauthorizedResponse() {
  return jsonResponse({ error: 'authentication required' }, { status: 401 });
}

export function forbiddenResponse() {
  return jsonResponse({ error: 'forbidden' }, { status: 403 });
}
