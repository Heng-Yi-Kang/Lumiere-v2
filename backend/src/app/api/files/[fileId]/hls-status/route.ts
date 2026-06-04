import { getAuthenticatedUser } from '@/lib/auth';
import { jsonResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { serializeHlsStatus } from '@/lib/hls-service';
import { prisma } from '@/lib/prisma';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(
  request: Request,
  context: { params: Promise<{ fileId: string }> },
) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const { fileId } = await context.params;
  const file = await prisma.notebookFile.findFirst({
    where: {
      id: fileId,
      notebook: {
        userId: user.id,
      },
    },
    select: {
      hlsGeneratedAt: true,
      hlsMasterPlaylistUrl: true,
      hlsStatus: true,
      videoDurationSeconds: true,
      videoResolution: true,
    },
  });

  if (!file) {
    return jsonResponse({ error: 'file not found' }, { status: 404 });
  }

  return jsonResponse({
    hls: serializeHlsStatus(file),
  });
}

