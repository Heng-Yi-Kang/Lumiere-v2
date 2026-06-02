import { StudyStreak } from '../types';
import { buildNotebookApiUrl } from './notebooksApi';

type StreakResponse = {
  error?: string;
  streak?: StudyStreak;
};

async function requestStreak<T>(path: string, init?: RequestInit): Promise<T> {
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
    const payload = (await response.json().catch(() => null)) as StreakResponse | null;
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function recordStudyActivity() {
  const payload = await requestStreak<StreakResponse>('/api/streak/activity', {
    method: 'POST',
  });

  if (!payload.streak) {
    throw new Error('Study streak was not returned by the API');
  }

  return payload.streak;
}
