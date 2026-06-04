import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import { getAuthenticatedUser } from '@/lib/auth';
import { applyCorsHeaders, jsonResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { getNotebookFileHlsDirectory } from '@/lib/hls-service';
import { prisma } from '@/lib/prisma';

const HLS_MIME_TYPES: Record<string, string> = {
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t',
};

function toWebStream(stream: ReturnType<typeof createReadStream>) {
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ fileId: string; hlsPath: string[]; notebookId: string }> },
) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const { fileId, hlsPath, notebookId } = await context.params;
  const extension = path.extname(hlsPath.at(-1) || '').toLowerCase();

  if (!HLS_MIME_TYPES[extension]) {
    return jsonResponse({ error: 'file not found' }, { status: 404 });
  }

  const file = await prisma.notebookFile.findFirst({
    where: {
      hlsStatus: 'READY',
      id: fileId,
      notebookId,
      type: 'video',
      notebook: {
        userId: user.id,
      },
    },
    select: {
      id: true,
    },
  });

  if (!file) {
    return jsonResponse({ error: 'file not found' }, { status: 404 });
  }

  const hlsDirectory = path.resolve(getNotebookFileHlsDirectory(notebookId, fileId));
  const requestedPath = path.resolve(hlsDirectory, ...hlsPath);

  if (requestedPath !== hlsDirectory && !requestedPath.startsWith(`${hlsDirectory}${path.sep}`)) {
    return jsonResponse({ error: 'file not found' }, { status: 404 });
  }

  const fileStat = await stat(requestedPath).catch(() => null);

  if (!fileStat?.isFile()) {
    return jsonResponse({ error: 'file not found' }, { status: 404 });
  }

  const headers = applyCorsHeaders(new Headers({
    'Cache-Control': 'private, max-age=300',
    'Content-Length': String(fileStat.size),
    'Content-Type': HLS_MIME_TYPES[extension],
  }));

  return new Response(toWebStream(createReadStream(requestedPath)), {
    headers,
  });
}

