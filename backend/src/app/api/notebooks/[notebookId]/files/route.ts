import { prisma } from '@/lib/prisma';
import { NotebookFileValidationError, persistNotebookUpload } from '@/lib/notebook-files';
import { jsonResponse, optionsResponse } from '@/lib/http';
import { serializeNotebook } from '@/lib/notebooks';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ notebookId: string }> },
) {
  const { notebookId } = await context.params;

  const existingNotebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    select: { id: true },
  });

  if (!existingNotebook) {
    return jsonResponse({ error: 'notebook not found' }, { status: 404 });
  }

  const formData = await request.formData().catch(() => null);
  const upload = formData?.get('file');

  if (!(upload instanceof File)) {
    return jsonResponse({ error: 'file is required' }, { status: 400 });
  }

  let uploadData;
  try {
    uploadData = await persistNotebookUpload(notebookId, upload);
  } catch (error) {
    if (error instanceof NotebookFileValidationError) {
      return jsonResponse({ error: error.message }, { status: 400 });
    }

    return jsonResponse({ error: 'Failed to process uploaded file.' }, { status: 500 });
  }

  const notebook = await prisma.notebook.update({
    where: { id: notebookId },
    data: {
      files: {
        create: {
          extractedText: uploadData.extractedText || null,
          mimeType: uploadData.mimeType,
          name: uploadData.name,
          previewContent: uploadData.previewContent || null,
          previewFormat: uploadData.previewFormat || null,
          size: uploadData.size,
          sourcePath: uploadData.sourcePath,
          status: 'ready',
          summary: uploadData.summary || null,
          totalPages: uploadData.totalPages ?? null,
          type: uploadData.type,
          uploadDate: uploadData.uploadDate,
        },
      },
    },
    include: {
      files: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return jsonResponse(
    {
      notebook: serializeNotebook(notebook),
    },
    { status: 201 },
  );
}
