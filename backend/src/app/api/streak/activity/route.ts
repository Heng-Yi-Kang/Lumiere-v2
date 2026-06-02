import { getAuthenticatedUser } from '@/lib/auth';
import { jsonResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { recordStudyActivity } from '@/lib/streak';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const streak = await recordStudyActivity(user.id);

  return jsonResponse({ streak });
}
