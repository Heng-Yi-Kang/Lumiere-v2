import { Notebook, NotebookFilePreview } from '../types';

export const NOTEBOOKS_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001').replace(/\/$/, '');

type NotebookResponse = {
  notebooks?: Notebook[];
  notebook?: Notebook;
  error?: string;
};

type NotebookPreviewResponse = {
  preview?: NotebookFilePreview;
  error?: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (!headers.has('Content-Type') && !(init?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${NOTEBOOKS_API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as NotebookResponse | null;
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchNotebooks() {
  const payload = await requestJson<NotebookResponse>('/api/notebooks');
  return payload.notebooks || [];
}

export async function createNotebook(input: {
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
  file: File,
) {
  const formData = new FormData();
  formData.append('file', file);

  const payload = await requestJson<NotebookResponse>(`/api/notebooks/${encodeURIComponent(notebookId)}/files`, {
    method: 'POST',
    body: formData,
  });

  if (!payload.notebook) {
    throw new Error('Notebook update was not returned by the API');
  }

  return payload.notebook;
}

export async function fetchNotebookFilePreview(notebookId: string, fileId: string) {
  const payload = await requestJson<NotebookPreviewResponse>(
    `/api/notebooks/${encodeURIComponent(notebookId)}/files/${encodeURIComponent(fileId)}`,
  );

  if (!payload.preview) {
    throw new Error('Notebook file preview was not returned by the API');
  }

  return payload.preview;
}

export async function deleteNotebookFile(notebookId: string, fileId: string) {
  const payload = await requestJson<NotebookResponse>(
    `/api/notebooks/${encodeURIComponent(notebookId)}/files/${encodeURIComponent(fileId)}`,
    {
      method: 'DELETE',
    },
  );

  if (!payload.notebook) {
    throw new Error('Notebook update was not returned by the API');
  }

  return payload.notebook;
}

export async function updateNotebook(
  notebookId: string,
  input: {
    name: string;
    description: string;
  },
) {
  const payload = await requestJson<NotebookResponse>(`/api/notebooks/${encodeURIComponent(notebookId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });

  if (!payload.notebook) {
    throw new Error('Notebook update was not returned by the API');
  }

  return payload.notebook;
}

export async function deleteNotebook(notebookId: string) {
  await requestJson<void>(`/api/notebooks/${encodeURIComponent(notebookId)}`, {
    method: 'DELETE',
  });
}
