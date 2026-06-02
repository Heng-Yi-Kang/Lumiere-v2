import { AuthUser } from '../types';
import { buildNotebookApiUrl } from './notebooksApi';

type AuthResponse = {
  error?: string;
  user?: AuthUser;
};

async function requestAuth(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(buildNotebookApiUrl(path), {
    ...init,
    credentials: 'include',
    headers,
  });
  const payload = (await response.json().catch(() => null)) as AuthResponse | null;

  if (!response.ok) {
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  return payload || {};
}

export async function fetchCurrentUser() {
  const payload = await requestAuth('/api/auth/me');

  if (!payload.user) {
    throw new Error('Current user was not returned by the API');
  }

  return payload.user;
}

export async function login(input: { email: string; password: string }) {
  const payload = await requestAuth('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!payload.user) {
    throw new Error('User was not returned by the API');
  }

  return payload.user;
}

export async function signup(input: { email: string; name: string; password: string }) {
  const payload = await requestAuth('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!payload.user) {
    throw new Error('User was not returned by the API');
  }

  return payload.user;
}

export async function logout() {
  await requestAuth('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({}),
  });
}
