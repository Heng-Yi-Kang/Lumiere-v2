import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const notes = await prisma.note.findMany({
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({ notes });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { title?: string; content?: string | null }
    | null;

  if (!body?.title?.trim()) {
    return NextResponse.json(
      {
        error: 'title is required',
      },
      { status: 400 },
    );
  }

  const note = await prisma.note.create({
    data: {
      title: body.title.trim(),
      content: body.content?.trim() || null,
    },
  });

  return NextResponse.json({ note }, { status: 201 });
}
