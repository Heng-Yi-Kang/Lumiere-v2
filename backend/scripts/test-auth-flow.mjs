#!/usr/bin/env node

import 'dotenv/config';

const baseUrl = (process.env.AUTH_TEST_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');
const origin = process.env.AUTH_TEST_ORIGIN || 'http://localhost:3000';
const password = process.env.AUTH_TEST_PASSWORD || 'password123';
const email = process.env.AUTH_TEST_EMAIL || `auth-test-${Date.now()}@lumiere.local`;
const name = process.env.AUTH_TEST_NAME || 'Auth Test User';
const timeoutMs = Number(process.env.AUTH_TEST_TIMEOUT_MS || 15_000);

function buildUrl(path) {
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

function cookieValue(setCookie) {
  return setCookie?.split(';')[0] || '';
}

function checkCredentialedCors(response, label) {
  const allowedOrigin = response.headers.get('Access-Control-Allow-Origin');
  const allowedCredentials = response.headers.get('Access-Control-Allow-Credentials');
  const problems = [];

  if (allowedCredentials !== 'true') {
    problems.push(`${label}: Access-Control-Allow-Credentials must be "true"`);
  }
  if (allowedOrigin !== origin) {
    problems.push(`${label}: Access-Control-Allow-Origin is "${allowedOrigin}", expected "${origin}"`);
  }
  if (allowedOrigin === '*') {
    problems.push(`${label}: browsers reject wildcard Access-Control-Allow-Origin with credentials: include`);
  }

  return problems;
}

async function request(path, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildUrl(path), {
      ...init,
      headers: {
        Origin: origin,
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
      signal: controller.signal,
    });
    const text = await response.text();
    let body = null;

    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }

    return { body, response };
  } finally {
    clearTimeout(timer);
  }
}

function assertOk(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  const failures = [];

  console.log(`Auth test target: ${baseUrl}`);
  console.log(`Credentialed request origin: ${origin}`);
  console.log(`Test user: ${email}`);

  const signup = await request('/api/auth/signup', {
    body: JSON.stringify({ email, name, password }),
    method: 'POST',
  });
  const signupCookie = cookieValue(signup.response.headers.get('Set-Cookie'));
  failures.push(...checkCredentialedCors(signup.response, 'signup'));
  assertOk(signup.response.status === 201, `signup returned ${signup.response.status}: ${JSON.stringify(signup.body)}`);
  assertOk(signup.body?.user?.email === email.toLowerCase(), `signup did not return expected user: ${JSON.stringify(signup.body)}`);
  assertOk(signupCookie, 'signup did not set a session cookie');
  console.log(`Signup: ${signup.response.status}, session cookie set`);

  const signupMe = await request('/api/auth/me', {
    headers: { Cookie: signupCookie },
  });
  failures.push(...checkCredentialedCors(signupMe.response, 'me after signup'));
  assertOk(signupMe.response.status === 200, `me after signup returned ${signupMe.response.status}: ${JSON.stringify(signupMe.body)}`);
  assertOk(signupMe.body?.user?.email === email.toLowerCase(), `me after signup returned wrong user: ${JSON.stringify(signupMe.body)}`);
  console.log(`Me after signup: ${signupMe.response.status}`);

  const login = await request('/api/auth/login', {
    body: JSON.stringify({ email, password }),
    method: 'POST',
  });
  const loginCookie = cookieValue(login.response.headers.get('Set-Cookie'));
  failures.push(...checkCredentialedCors(login.response, 'login'));
  assertOk(login.response.status === 200, `login returned ${login.response.status}: ${JSON.stringify(login.body)}`);
  assertOk(login.body?.user?.email === email.toLowerCase(), `login did not return expected user: ${JSON.stringify(login.body)}`);
  assertOk(loginCookie, 'login did not set a session cookie');
  console.log(`Login: ${login.response.status}, session cookie set`);

  const loginMe = await request('/api/auth/me', {
    headers: { Cookie: loginCookie },
  });
  failures.push(...checkCredentialedCors(loginMe.response, 'me after login'));
  assertOk(loginMe.response.status === 200, `me after login returned ${loginMe.response.status}: ${JSON.stringify(loginMe.body)}`);
  assertOk(loginMe.body?.user?.email === email.toLowerCase(), `me after login returned wrong user: ${JSON.stringify(loginMe.body)}`);
  console.log(`Me after login: ${loginMe.response.status}`);

  if (failures.length > 0) {
    console.error('\nCredentialed browser CORS check failed:');
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nAuth flow passed.');
}

main().catch((error) => {
  console.error(`\nAuth flow failed: ${error.message}`);
  process.exitCode = 1;
});
