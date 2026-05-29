import { FileItem, Notebook } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');

type NotebookResponse = {
  notebooks?: Notebook[];
  notebook?: Notebook;
  error?: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as NotebookResponse | null;
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function fetchNotebooks(universityId: string) {
  const payload = await requestJson<NotebookResponse>(`/api/notebooks?universityId=${encodeURIComponent(universityId)}`);
  return payload.notebooks || [];
}

export async function createNotebook(input: {
  universityId: string;
  name: string;
  courseCode: string;
  color: string;
  description: string;
}) {
  const payload = await requestJson<NotebookResponse>('/api/notebooks', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  if (!payload.notebook) {
    throw new Error('Notebook was not returned by the API');
  }

  return payload.notebook;
}

export async function createNotebookFile(
  notebookId: string,
  file: Omit<FileItem, 'id'> & { sourceUrl?: string },
) {
  const payload = await requestJson<NotebookResponse>(`/api/notebooks/${encodeURIComponent(notebookId)}/files`, {
    method: 'POST',
    body: JSON.stringify(file),
  });

  if (!payload.notebook) {
    throw new Error('Notebook update was not returned by the API');
  }

  return payload.notebook;
}
