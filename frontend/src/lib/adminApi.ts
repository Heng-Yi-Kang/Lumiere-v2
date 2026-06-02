import { AdminUser } from '../types';
import { buildNotebookApiUrl } from './notebooksApi';

type AdminUsersResponse = {
  error?: string;
  user?: Partial<AdminUser>;
  users?: AdminUser[];
};

async function requestAdmin<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(buildNotebookApiUrl(path), {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as AdminUsersResponse | null;
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchAdminUsers() {
  const payload = await requestAdmin<AdminUsersResponse>('/api/admin/users');
  return payload.users || [];
}

export async function setAdminUserDisabled(userId: string, disabled: boolean) {
  const payload = await requestAdmin<AdminUsersResponse>(`/api/admin/users/${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    body: JSON.stringify({ disabled }),
  });

  if (!payload.user) {
    throw new Error('User was not returned by the API');
  }

  return payload.user;
}
