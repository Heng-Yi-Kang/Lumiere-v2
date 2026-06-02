import { getAuthenticatedUser, serializeAuthUser } from '@/lib/auth';
import { jsonResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  return jsonResponse({
    user: serializeAuthUser(user),
  });
}
