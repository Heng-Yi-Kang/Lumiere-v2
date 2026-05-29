import { prisma } from '@/lib/prisma';
import { jsonResponse, optionsResponse } from '@/lib/http';
import { serializeNotebook } from '@/lib/notebooks';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const notebooks = await prisma.notebook.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      files: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return jsonResponse({
    notebooks: notebooks.map(serializeNotebook),
  });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | {
        name?: string;
        courseCode?: string;
        color?: string;
        description?: string;
      }
    | null;

  if (!body?.name?.trim()) {
    return jsonResponse({ error: 'name is required' }, { status: 400 });
  }
  if (!body?.courseCode?.trim()) {
    return jsonResponse({ error: 'courseCode is required' }, { status: 400 });
  }

  const notebook = await prisma.notebook.create({
    data: {
      name: body.name.trim(),
      courseCode: body.courseCode.trim().toUpperCase(),
      color: body.color?.trim() || 'blue',
      description: body.description?.trim() || '',
      conceptCount: 0,
    },
    include: {
      files: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  return jsonResponse({
    notebook: serializeNotebook(notebook),
  }, { status: 201 });
}
