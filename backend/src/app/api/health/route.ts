import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return NextResponse.json({
      status: 'ok',
      database: 'connected',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown database error';

    return NextResponse.json(
      {
        status: 'degraded',
        database: 'error',
        error: message,
      },
      { status: 503 },
    );
  }
}
