import { buildClearSessionCookie, deleteCurrentSession } from '@/lib/auth';
import { jsonResponse, optionsResponse } from '@/lib/http';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  await deleteCurrentSession(request);

  return jsonResponse(
    { ok: true },
    {
      headers: {
        'Set-Cookie': buildClearSessionCookie(),
      },
    },
  );
}
