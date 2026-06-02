import { Goal } from '../types';
import { buildNotebookApiUrl } from './notebooksApi';

type GoalsResponse = {
  error?: string;
  goal?: Goal;
  goals?: Goal[];
};

async function requestGoals<T>(path: string, init?: RequestInit): Promise<T> {
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
    const payload = (await response.json().catch(() => null)) as GoalsResponse | null;
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchGoals() {
  const payload = await requestGoals<GoalsResponse>('/api/goals');
  return payload.goals || [];
}

export async function createGoal(text: string) {
  const payload = await requestGoals<GoalsResponse>('/api/goals', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });

  if (!payload.goal) {
    throw new Error('Goal was not returned by the API');
  }

  return payload.goal;
}

export async function updateGoal(goalId: string, input: Partial<Pick<Goal, 'completed' | 'isPriority' | 'text'>>) {
  const payload = await requestGoals<GoalsResponse>(`/api/goals/${encodeURIComponent(goalId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

  if (!payload.goal) {
    throw new Error('Goal was not returned by the API');
  }

  return payload.goal;
}

export async function deleteGoal(goalId: string) {
  await requestGoals<void>(`/api/goals/${encodeURIComponent(goalId)}`, {
    method: 'DELETE',
  });
}
