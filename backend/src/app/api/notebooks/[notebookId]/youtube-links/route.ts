import { getAuthenticatedUser } from '@/lib/auth';
import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import { jsonResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { serializeNotebook } from '@/lib/notebooks';
import { prisma } from '@/lib/prisma';
import { enqueueNotebookFileVideoIngestionJob } from '@/lib/video-ingestion-job';
import {
  normalizeYoutubeVideoUrl,
  probeYoutubeVideoMetadata,
  YoutubeVideoValidationError,
} from '@/lib/youtube-video-ingestion';

export async function OPTIONS() {
  return optionsResponse();
}

function formatUploadDate(date: Date) {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ notebookId: string }> },
) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const requestStartedAt = performance.now();
  const { notebookId } = await context.params;
  const body = await request.json().catch(() => null) as { url?: unknown } | null;

  if (!body || typeof body.url !== 'string') {
    return jsonResponse({ error: 'url is required' }, { status: 400 });
  }

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeYoutubeVideoUrl(body.url).canonicalUrl;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Enter a valid YouTube URL.';
    return jsonResponse({ error: message }, { status: 400 });
  }

  logBackendProcess('info', 'youtube_link.api.create.started', {
    notebookId,
    url: normalizedUrl,
  });

  const existingNotebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    select: { id: true, userId: true },
  });

  if (!existingNotebook || existingNotebook.userId !== user.id) {
    return jsonResponse({ error: 'notebook not found' }, { status: 404 });
  }

  const duplicate = await prisma.notebookFile.findFirst({
    where: {
      notebookId,
      sourceUrl: normalizedUrl,
    },
    select: { id: true },
  });

  if (duplicate) {
    return jsonResponse({ error: 'This YouTube video is already in the notebook.' }, { status: 409 });
  }

  let metadata;
  try {
    metadata = await probeYoutubeVideoMetadata(normalizedUrl);
  } catch (error) {
    const message = error instanceof YoutubeVideoValidationError
      ? error.message
      : 'Failed to validate that YouTube video.';
    return jsonResponse({ error: message }, { status: 400 });
  }

  const notebook = await prisma.notebook.update({
    where: { id: notebookId },
    data: {
      files: {
        create: {
          extractedText: null,
          ingestionError: null,
          mimeType: 'video/mp4',
          name: metadata.title,
          previewContent: null,
          previewFormat: null,
          siteName: 'YouTube',
          size: metadata.estimatedSizeBytes ? `${Math.ceil(metadata.estimatedSizeBytes / 1024 / 1024)} MB pending` : 'Pending download',
          sourcePath: null,
          sourceUrl: metadata.canonicalUrl,
          status: 'processing',
          summary: null,
          summaryError: null,
          summaryGeneratedAt: null,
          summaryStatus: 'idle',
          totalPages: null,
          type: 'video',
          uploadDate: formatUploadDate(new Date()),
        },
      },
    },
    include: {
      files: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const createdFile = notebook.files.find((file) => file.sourceUrl === metadata.canonicalUrl);

  if (!createdFile) {
    return jsonResponse({ error: 'Failed to persist YouTube video.' }, { status: 500 });
  }

  try {
    await enqueueNotebookFileVideoIngestionJob(createdFile.id);
  } catch (error) {
    await prisma.notebookFile.delete({
      where: { id: createdFile.id },
    }).catch(() => undefined);
    return jsonResponse(
      { error: error instanceof Error ? error.message : 'Failed to queue YouTube video ingestion.' },
      { status: 500 },
    );
  }

  const refreshedNotebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    include: {
      files: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  logBackendProcess('info', 'youtube_link.api.create.completed', {
    elapsedMs: getElapsedMs(requestStartedAt),
    fileId: createdFile.id,
    notebookId,
    url: metadata.canonicalUrl,
  });

  return jsonResponse(
    {
      notebook: refreshedNotebook ? serializeNotebook(refreshedNotebook) : serializeNotebook(notebook),
    },
    { status: 201 },
  );
}
