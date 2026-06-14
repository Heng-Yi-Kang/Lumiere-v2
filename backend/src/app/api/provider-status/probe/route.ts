import { getAuthenticatedUser } from '@/lib/auth';
import { jsonResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { probeProviderStatuses } from '@/lib/provider-status';

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  return jsonResponse({
    providers: await probeProviderStatuses(),
  });
}
