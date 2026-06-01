import { NextResponse } from 'next/server';

import { optionsResponse } from '@/lib/http';

const swaggerHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Lumiere Backend API</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    <style>
      body {
        margin: 0;
        background: #f7f8fb;
      }

      .swagger-ui .topbar {
        display: none;
      }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({
          url: '/api/openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          displayRequestDuration: true,
          filter: true,
          tryItOutEnabled: true,
          docExpansion: 'list',
        });
      };
    </script>
  </body>
</html>`;

export async function OPTIONS() {
  return optionsResponse();
}

export async function GET() {
  return new NextResponse(swaggerHtml, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  });
}
