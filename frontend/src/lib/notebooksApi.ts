import { FileNote, GroundedChatResponse, Notebook, NotebookFilePreview } from '../types';

export const NOTEBOOKS_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '');

type NotebookResponse = {
  notebooks?: Notebook[];
  notebook?: Notebook;
  error?: string;
};

type NotebookPreviewResponse = {
  preview?: NotebookFilePreview;
  error?: string;
};

type GroundedChatApiResponse = GroundedChatResponse & {
  error?: string;
};

type FileNotesResponse = {
  notes?: FileNote[];
  note?: FileNote;
  error?: string;
};

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);

  if (!headers.has('Content-Type') && !(init?.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(buildNotebookApiUrl(path), {
    ...init,
    credentials: 'include',
    headers,
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as NotebookResponse | null;
    throw new Error(payload?.error || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json()) as T & { error?: string };

  if (payload?.error) {
    throw new Error(payload.error);
  }

  return payload;
}

export function buildNotebookApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${NOTEBOOKS_API_BASE_URL}${normalizedPath}`;
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

export async function createNotebookFiles(
  notebookId: string,
  files: File[],
) {
  const formData = new FormData();
  for (const file of files) {
    formData.append('file', file);
  }

  const payload = await requestJson<NotebookResponse>(`/api/notebooks/${encodeURIComponent(notebookId)}/files`, {
    method: 'POST',
    body: formData,
  });

  if (!payload.notebook) {
    throw new Error('Notebook update was not returned by the API');
  }

  return payload.notebook;
}

export async function createNotebookFile(
  notebookId: string,
  file: File,
) {
  return createNotebookFiles(notebookId, [file]);
}

export async function createNotebookLink(
  notebookId: string,
  url: string,
) {
  const payload = await requestJson<NotebookResponse>(`/api/notebooks/${encodeURIComponent(notebookId)}/links`, {
    method: 'POST',
    body: JSON.stringify({ url }),
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

export async function retryNotebookFileSummary(notebookId: string, fileId: string) {
  const payload = await requestJson<NotebookResponse>(
    `/api/notebooks/${encodeURIComponent(notebookId)}/files/${encodeURIComponent(fileId)}`,
    {
      method: 'POST',
    },
  );

  if (!payload.notebook) {
    throw new Error('Notebook update was not returned by the API');
  }

  return payload.notebook;
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
    color: string;
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

export async function askGroundedNotebookChat(input: {
  fileId?: string;
  notebookId: string;
  question: string;
}) {
  return requestJson<GroundedChatApiResponse>(
    `/api/notebooks/${encodeURIComponent(input.notebookId)}/rag/chat`,
    {
      method: 'POST',
      body: JSON.stringify({
        fileId: input.fileId,
        question: input.question,
      }),
    },
  );
}

export async function fetchFileNotes(notebookId: string, fileId: string) {
  const payload = await requestJson<FileNotesResponse>(
    `/api/notebooks/${encodeURIComponent(notebookId)}/files/${encodeURIComponent(fileId)}/notes`,
  );

  return payload.notes || [];
}

export async function createFileNote(
  notebookId: string,
  fileId: string,
  input: {
    title: string;
    body: string;
  },
) {
  const payload = await requestJson<FileNotesResponse>(
    `/api/notebooks/${encodeURIComponent(notebookId)}/files/${encodeURIComponent(fileId)}/notes`,
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );

  if (!payload.note) {
    throw new Error('Created note was not returned by the API');
  }

  return payload.note;
}

export async function updateFileNote(
  notebookId: string,
  fileId: string,
  noteId: string,
  input: {
    title: string;
    body: string;
  },
) {
  const payload = await requestJson<FileNotesResponse>(
    `/api/notebooks/${encodeURIComponent(notebookId)}/files/${encodeURIComponent(fileId)}/notes/${encodeURIComponent(noteId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(input),
    },
  );

  if (!payload.note) {
    throw new Error('Updated note was not returned by the API');
  }

  return payload.note;
}

export async function deleteFileNote(notebookId: string, fileId: string, noteId: string) {
  await requestJson<void>(
    `/api/notebooks/${encodeURIComponent(notebookId)}/files/${encodeURIComponent(fileId)}/notes/${encodeURIComponent(noteId)}`,
    {
      method: 'DELETE',
    },
  );
}
