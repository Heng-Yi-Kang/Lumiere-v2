import { jsonResponse, optionsResponse } from '@/lib/http';
import { openApiDocument } from '@/lib/openapi';

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  return jsonResponse(openApiDocument);
}
