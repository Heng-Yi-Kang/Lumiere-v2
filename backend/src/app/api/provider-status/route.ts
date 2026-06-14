import { getAuthenticatedUser } from '@/lib/auth';
import { jsonResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { buildProviderConfigStatuses } from '@/lib/provider-status';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET(request: Request) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  return jsonResponse({
    providers: buildProviderConfigStatuses(),
  });
}
