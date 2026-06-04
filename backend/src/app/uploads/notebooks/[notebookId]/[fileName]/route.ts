import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { getAuthenticatedUser } from '@/lib/auth';
import { applyCorsHeaders, jsonResponse, unauthorizedResponse } from '@/lib/http';
import { getNotebookUploadRoot } from '@/lib/notebook-upload-root';
import { prisma } from '@/lib/prisma';

const DEFAULT_MIME_TYPE = 'application/octet-stream';

function parseRangeHeader(rangeHeader: string | null, fileSize: number) {
  if (!rangeHeader) {
    return null;
  }

  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match) {
    return undefined;
  }

  const [, startValue, endValue] = match;

  if (!startValue && !endValue) {
    return undefined;
  }

  const start = startValue ? Number(startValue) : Math.max(fileSize - Number(endValue), 0);
  const end = endValue ? Number(endValue) : fileSize - 1;

  if (
    !Number.isSafeInteger(start)
    || !Number.isSafeInteger(end)
    || start < 0
    || end < start
    || start >= fileSize
  ) {
    return undefined;
  }

  return {
    end: Math.min(end, fileSize - 1),
    start,
  };
}

function toWebStream(stream: ReturnType<typeof createReadStream>) {
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

export async function GET(
  request: Request,
  context: { params: Promise<{ notebookId: string; fileName: string }> },
) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const { fileName, notebookId } = await context.params;
  const uploadRoot = path.resolve(getNotebookUploadRoot());
  const notebookUploadDirectory = path.resolve(uploadRoot, notebookId);
  const requestedPath = path.resolve(notebookUploadDirectory, fileName);

  if (!requestedPath.startsWith(`${notebookUploadDirectory}${path.sep}`)) {
    return jsonResponse({ error: 'file not found' }, { status: 404 });
  }

  const file = await prisma.notebookFile.findFirst({
    where: {
      notebookId,
      sourcePath: requestedPath,
      notebook: {
        userId: user.id,
      },
    },
    select: {
      mimeType: true,
      name: true,
    },
  });

  if (!file) {
    return jsonResponse({ error: 'file not found' }, { status: 404 });
  }

  const fileStat = await stat(requestedPath).catch(() => null);

  if (!fileStat?.isFile()) {
    return jsonResponse({ error: 'file not found' }, { status: 404 });
  }

  const range = parseRangeHeader(request.headers.get('range'), fileStat.size);

  if (range === undefined) {
    return new Response(null, {
      status: 416,
      headers: {
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes */${fileStat.size}`,
      },
    });
  }

  const headers = applyCorsHeaders(new Headers({
    'Accept-Ranges': 'bytes',
    'Content-Type': file.mimeType || DEFAULT_MIME_TYPE,
  }));

  if (!range) {
    headers.set('Content-Length', String(fileStat.size));

    return new Response(toWebStream(createReadStream(requestedPath)), {
      headers,
    });
  }

  const contentLength = range.end - range.start + 1;
  headers.set('Content-Length', String(contentLength));
  headers.set('Content-Range', `bytes ${range.start}-${range.end}/${fileStat.size}`);

  return new Response(
    toWebStream(createReadStream(requestedPath, {
      end: range.end,
      start: range.start,
    })),
    {
      status: 206,
      headers,
    },
  );
}
