export const openApiDocument = {
  openapi: '3.1.0',
  info: {
    title: 'Lumiere Backend API',
    version: '0.1.0',
    description: 'Interactive documentation for the Lumiere notebook, file, note, and RAG APIs.',
  },
  servers: [
    {
      url: '/',
      description: 'Current backend origin',
    },
  ],
  tags: [
    { name: 'Documentation' },
    { name: 'Health' },
    { name: 'Notebooks' },
    { name: 'Files' },
    { name: 'Notes' },
    { name: 'RAG' },
    { name: 'Streak' },
  ],
  paths: {
    '/api': {
      get: {
        tags: ['Documentation'],
        summary: 'Open Swagger UI',
        responses: {
          '200': {
            description: 'Swagger UI HTML',
            content: {
              'text/html': {
                schema: { type: 'string' },
              },
            },
          },
        },
      },
    },
    '/api/openapi.json': {
      get: {
        tags: ['Documentation'],
        summary: 'Get the OpenAPI document',
        responses: {
          '200': {
            description: 'OpenAPI document',
            content: {
              'application/json': {
                schema: { type: 'object' },
              },
            },
          },
        },
      },
    },
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'Check backend and database health',
        responses: {
          '200': {
            description: 'Backend is healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
          '503': {
            description: 'Database connectivity failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
        },
      },
    },
    '/api/notebooks': {
      get: {
        tags: ['Notebooks'],
        summary: 'List notebooks',
        responses: {
          '200': {
            description: 'Notebooks ordered by most recently updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['notebooks'],
                  properties: {
                    notebooks: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Notebook' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Notebooks'],
        summary: 'Create a notebook',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateNotebookRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Notebook created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NotebookResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
        },
      },
    },
    '/api/notebooks/{notebookId}': {
      patch: {
        tags: ['Notebooks'],
        summary: 'Update a notebook',
        parameters: [{ $ref: '#/components/parameters/NotebookId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpdateNotebookRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Notebook updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NotebookResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Notebooks'],
        summary: 'Delete a notebook',
        parameters: [{ $ref: '#/components/parameters/NotebookId' }],
        responses: {
          '204': { description: 'Notebook deleted' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/notebooks/{notebookId}/saved-chat-reply': {
      get: {
        tags: ['Notebooks'],
        summary: 'List notebook saved chat replies',
        parameters: [{ $ref: '#/components/parameters/NotebookId' }],
        responses: {
          '200': {
            description: 'Saved chat replies ordered newest first',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SavedChatReplyResponse' },
              },
            },
          },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      put: {
        tags: ['Notebooks'],
        summary: 'Save a notebook chat reply',
        parameters: [{ $ref: '#/components/parameters/NotebookId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpsertSavedChatReplyRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Saved chat reply',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SavedChatReplyResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Notebooks'],
        summary: 'Clear notebook saved chat replies',
        parameters: [{ $ref: '#/components/parameters/NotebookId' }],
        responses: {
          '204': { description: 'Saved chat replies cleared' },
          '401': { $ref: '#/components/responses/Unauthorized' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/notebooks/{notebookId}/files': {
      post: {
        tags: ['Files'],
        summary: 'Upload a file to a notebook',
        parameters: [{ $ref: '#/components/parameters/NotebookId' }],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                required: ['file'],
                properties: {
                  file: {
                    type: 'string',
                    format: 'binary',
                  },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'File uploaded, persisted, and indexed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NotebookResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
          '429': { $ref: '#/components/responses/RateLimited' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/api/notebooks/{notebookId}/links': {
      post: {
        tags: ['Files'],
        summary: 'Add a web link to a notebook',
        parameters: [{ $ref: '#/components/parameters/NotebookId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/CreateNotebookLinkRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Web link scraped, persisted, and indexed when readable text is available',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NotebookResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
          '409': { $ref: '#/components/responses/Conflict' },
          '500': { $ref: '#/components/responses/InternalError' },
        },
      },
    },
    '/api/notebooks/{notebookId}/files/{fileId}': {
      get: {
        tags: ['Files'],
        summary: 'Get a file preview',
        parameters: [
          { $ref: '#/components/parameters/NotebookId' },
          { $ref: '#/components/parameters/FileId' },
        ],
        responses: {
          '200': {
            description: 'File preview metadata and content',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FilePreviewResponse' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      post: {
        tags: ['Files'],
        summary: 'Retry file summary generation',
        parameters: [
          { $ref: '#/components/parameters/NotebookId' },
          { $ref: '#/components/parameters/FileId' },
        ],
        responses: {
          '200': {
            description: 'Summary retry scheduled and notebook returned',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NotebookResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      patch: {
        tags: ['Files'],
        summary: 'Rename a notebook file',
        description: 'Updates only the display name. Stored file paths, source URLs, scraped metadata, and indexed content are unchanged.',
        parameters: [
          { $ref: '#/components/parameters/NotebookId' },
          { $ref: '#/components/parameters/FileId' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RenameNotebookFileRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'File renamed and notebook returned',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/NotebookResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Files'],
        summary: 'Delete a notebook file',
        parameters: [
          { $ref: '#/components/parameters/NotebookId' },
          { $ref: '#/components/parameters/FileId' },
        ],
        responses: {
          '200': {
            description: 'File deleted and notebook returned',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['notebook'],
                  properties: {
                    notebook: {
                      oneOf: [{ $ref: '#/components/schemas/Notebook' }, { type: 'null' }],
                    },
                  },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/files/{fileId}/hls-status': {
      get: {
        tags: ['Files'],
        summary: 'Get HLS generation status for a file',
        parameters: [{ $ref: '#/components/parameters/FileId' }],
        responses: {
          '200': {
            description: 'HLS playback metadata',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HlsStatusResponse' },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/notebooks/{notebookId}/files/{fileId}/notes': {
      get: {
        tags: ['Notes'],
        summary: 'List notes for a file',
        parameters: [
          { $ref: '#/components/parameters/NotebookId' },
          { $ref: '#/components/parameters/FileId' },
        ],
        responses: {
          '200': {
            description: 'Notes ordered by most recently updated',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['notes'],
                  properties: {
                    notes: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/FileNote' },
                    },
                  },
                },
              },
            },
          },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      post: {
        tags: ['Notes'],
        summary: 'Create a note for a file',
        parameters: [
          { $ref: '#/components/parameters/NotebookId' },
          { $ref: '#/components/parameters/FileId' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpsertFileNoteRequest' },
            },
          },
        },
        responses: {
          '201': {
            description: 'Note created',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FileNoteResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/notebooks/{notebookId}/files/{fileId}/notes/{noteId}': {
      patch: {
        tags: ['Notes'],
        summary: 'Update a file note',
        parameters: [
          { $ref: '#/components/parameters/NotebookId' },
          { $ref: '#/components/parameters/FileId' },
          { $ref: '#/components/parameters/NoteId' },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/UpsertFileNoteRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Note updated',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/FileNoteResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
      delete: {
        tags: ['Notes'],
        summary: 'Delete a file note',
        parameters: [
          { $ref: '#/components/parameters/NotebookId' },
          { $ref: '#/components/parameters/FileId' },
          { $ref: '#/components/parameters/NoteId' },
        ],
        responses: {
          '204': { description: 'Note deleted' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/notebooks/{notebookId}/rag/search': {
      post: {
        tags: ['RAG'],
        summary: 'Search indexed notebook content',
        parameters: [{ $ref: '#/components/parameters/NotebookId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RagSearchRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Search results',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RagSearchResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
        },
      },
    },
    '/api/notebooks/{notebookId}/rag/chat': {
      post: {
        tags: ['RAG'],
        summary: 'Ask a grounded question about notebook content',
        parameters: [{ $ref: '#/components/parameters/NotebookId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RagChatRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'Grounded answer or no-context message',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/RagChatResponse' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
          '502': {
            description: 'RAG search or chat generation failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/notebooks/{notebookId}/rag/chat/stream': {
      post: {
        tags: ['RAG'],
        summary: 'Stream a grounded answer about notebook content',
        description: [
          'Returns Server-Sent Events from a POST request.',
          '`delta` events contain `{ "text": string }`.',
          '`done` events contain the final `RagChatResponse` payload.',
          '`error` events contain `{ "error": string }`.',
        ].join(' '),
        parameters: [{ $ref: '#/components/parameters/NotebookId' }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/RagChatRequest' },
            },
          },
        },
        responses: {
          '200': {
            description: 'SSE stream of grounded chat events',
            content: {
              'text/event-stream': {
                schema: { $ref: '#/components/schemas/RagChatStreamEvent' },
              },
            },
          },
          '400': { $ref: '#/components/responses/BadRequest' },
          '404': { $ref: '#/components/responses/NotFound' },
          '502': {
            description: 'RAG retrieval failed',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
    '/api/streak/activity': {
      post: {
        tags: ['Streak'],
        summary: 'Record today as an active study day',
        responses: {
          '200': {
            description: 'Updated study streak for the authenticated user',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/StudyStreakResponse' },
              },
            },
          },
          '401': {
            description: 'Authentication is required',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' },
              },
            },
          },
        },
      },
    },
  },
  components: {
    parameters: {
      NotebookId: {
        name: 'notebookId',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
      FileId: {
        name: 'fileId',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
      NoteId: {
        name: 'noteId',
        in: 'path',
        required: true,
        schema: { type: 'string' },
      },
    },
    responses: {
      BadRequest: {
        description: 'Invalid request',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      Unauthorized: {
        description: 'Authentication is required',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      NotFound: {
        description: 'Resource not found',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      RateLimited: {
        description: 'Request was rate limited by an upstream AI service',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      Conflict: {
        description: 'Resource already exists',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
      InternalError: {
        description: 'Unexpected server error',
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/ErrorResponse' },
          },
        },
      },
    },
    schemas: {
      ErrorResponse: {
        type: 'object',
        required: ['error'],
        properties: {
          error: { type: 'string' },
        },
      },
      HealthResponse: {
        type: 'object',
        required: ['status', 'database'],
        properties: {
          status: { type: 'string', enum: ['ok', 'degraded'] },
          database: { type: 'string', enum: ['connected', 'error'] },
          error: { type: 'string' },
        },
      },
      Notebook: {
        type: 'object',
        required: ['id', 'name', 'courseCode', 'color', 'description', 'conceptCount', 'fileCount', 'files'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          courseCode: { type: 'string' },
          color: { type: 'string' },
          description: { type: 'string' },
          conceptCount: { type: 'integer' },
          fileCount: { type: 'integer' },
          files: {
            type: 'array',
            items: { $ref: '#/components/schemas/NotebookFile' },
          },
        },
      },
      NotebookFile: {
        type: 'object',
        required: ['id', 'name', 'type', 'mimeType', 'size', 'uploadDate', 'status', 'summaryStatus'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          type: {
            type: 'string',
            enum: ['pdf', 'docx', 'pptx', 'txt', 'audio', 'video', 'image', 'link'],
          },
          mimeType: { type: ['string', 'null'] },
          size: { type: 'string' },
          siteName: { type: 'string' },
          sourceUrl: { type: 'string' },
          uploadDate: { type: 'string' },
          status: { type: 'string', enum: ['processing', 'ready', 'error'] },
          ingestionError: { type: 'string' },
          summary: {
            type: 'string',
            description: 'Final summary when done; may contain partial generated text while summaryStatus is in-progress.',
          },
          summaryError: { type: 'string' },
          summaryGeneratedAt: { type: 'string', format: 'date-time' },
          summaryStatus: { type: 'string', enum: ['idle', 'in-progress', 'done', 'error'] },
          hlsGeneratedAt: { type: 'string', format: 'date-time' },
          hlsMasterPlaylistUrl: { type: 'string' },
          hlsStatus: { type: 'string', enum: ['PENDING', 'PROCESSING', 'READY', 'FAILED'] },
          videoDurationSeconds: { type: 'number' },
          videoResolution: { type: 'string' },
          totalPages: { type: 'integer' },
        },
      },
      NotebookResponse: {
        type: 'object',
        required: ['notebook'],
        properties: {
          notebook: { $ref: '#/components/schemas/Notebook' },
        },
      },
      CreateNotebookRequest: {
        type: 'object',
        required: ['name', 'courseCode'],
        properties: {
          name: { type: 'string' },
          courseCode: { type: 'string' },
          color: { type: 'string', default: 'blue' },
          description: { type: 'string' },
        },
      },
      CreateNotebookLinkRequest: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string', format: 'uri' },
        },
      },
      UpdateNotebookRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          color: { type: 'string', default: 'blue' },
          description: { type: 'string' },
        },
      },
      SavedChatReply: {
        type: 'object',
        required: ['id', 'notebookId', 'question', 'answer', 'scopeType', 'citations', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'string' },
          notebookId: { type: 'string' },
          question: { type: 'string' },
          answer: { type: 'string' },
          fileId: { type: 'string' },
          fileName: { type: 'string' },
          scopeType: { type: 'string', enum: ['notebook', 'file'] },
          citations: {
            type: 'array',
            items: { $ref: '#/components/schemas/RagCitation' },
          },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      SavedChatReplyResponse: {
        type: 'object',
        required: ['savedChatReply', 'savedChatReplies'],
        properties: {
          savedChatReply: {
            oneOf: [
              { $ref: '#/components/schemas/SavedChatReply' },
              { type: 'null' },
            ],
          },
          savedChatReplies: {
            type: 'array',
            items: { $ref: '#/components/schemas/SavedChatReply' },
          },
        },
      },
      UpsertSavedChatReplyRequest: {
        type: 'object',
        required: ['question', 'answer'],
        properties: {
          question: { type: 'string' },
          answer: { type: 'string' },
          fileId: { type: 'string' },
          fileName: { type: 'string' },
          scopeType: { type: 'string', enum: ['notebook', 'file'], default: 'notebook' },
          citations: {
            type: 'array',
            items: { $ref: '#/components/schemas/RagCitation' },
            default: [],
          },
        },
      },
      RenameNotebookFileRequest: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {
            type: 'string',
            minLength: 1,
            maxLength: 120,
          },
        },
      },
      FilePreviewResponse: {
        type: 'object',
        required: ['preview'],
        properties: {
          preview: { $ref: '#/components/schemas/FilePreview' },
        },
      },
      FilePreview: {
        type: 'object',
        required: ['id', 'name', 'sourceUrl', 'summaryStatus', 'type'],
        properties: {
          id: { type: 'string' },
          mimeType: { type: 'string' },
          name: { type: 'string' },
          previewContent: { type: 'string' },
          previewFormat: { type: 'string' },
          status: { type: 'string', enum: ['processing', 'ready', 'error'] },
          ingestionError: { type: 'string' },
          siteName: { type: 'string' },
          sourceUrl: { type: 'string' },
          summary: {
            type: 'string',
            description: 'Final summary when done; may contain partial generated text while summaryStatus is in-progress.',
          },
          summaryError: { type: 'string' },
          summaryGeneratedAt: { type: 'string', format: 'date-time' },
          summaryStatus: { type: 'string', enum: ['idle', 'in-progress', 'done', 'error'] },
          hlsGeneratedAt: { type: 'string', format: 'date-time' },
          hlsMasterPlaylistUrl: { type: 'string' },
          hlsStatus: { type: 'string', enum: ['PENDING', 'PROCESSING', 'READY', 'FAILED'] },
          videoDurationSeconds: { type: 'number' },
          videoResolution: { type: 'string' },
          totalPages: { type: 'integer' },
          type: { type: 'string' },
        },
      },
      HlsStatusResponse: {
        type: 'object',
        required: ['hls'],
        properties: {
          hls: {
            type: 'object',
            required: ['hlsStatus'],
            properties: {
              hlsGeneratedAt: { type: 'string', format: 'date-time' },
              hlsMasterPlaylistUrl: { type: 'string' },
              hlsStatus: { type: 'string', enum: ['PENDING', 'PROCESSING', 'READY', 'FAILED'] },
              videoDurationSeconds: { type: 'number' },
              videoResolution: { type: 'string' },
            },
          },
        },
      },
      FileNote: {
        type: 'object',
        required: ['id', 'fileId', 'title', 'body', 'createdAt', 'updatedAt'],
        properties: {
          id: { type: 'string' },
          fileId: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      FileNoteResponse: {
        type: 'object',
        required: ['note'],
        properties: {
          note: { $ref: '#/components/schemas/FileNote' },
        },
      },
      UpsertFileNoteRequest: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string' },
          body: { type: 'string' },
        },
      },
      StudyStreakResponse: {
        type: 'object',
        required: ['streak'],
        properties: {
          streak: { $ref: '#/components/schemas/StudyStreak' },
        },
      },
      StudyStreak: {
        type: 'object',
        required: ['currentStreak', 'bestStreak', 'lastActive', 'weeklyProgress', 'malaysianTier'],
        properties: {
          currentStreak: { type: 'integer', minimum: 0 },
          bestStreak: { type: 'integer', minimum: 0 },
          lastActive: { type: 'string' },
          weeklyProgress: {
            type: 'array',
            items: { $ref: '#/components/schemas/StudyStreakDay' },
          },
          malaysianTier: {
            type: 'string',
            enum: ['Faithful Student', 'Kopi Beng Devotee', "Dean's Runner", 'Royal Award Winner'],
          },
        },
      },
      StudyStreakDay: {
        type: 'object',
        required: ['day', 'active'],
        properties: {
          day: { type: 'string', enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
          active: { type: 'boolean' },
        },
      },
      RagSearchRequest: {
        type: 'object',
        required: ['query'],
        properties: {
          query: { type: 'string' },
          fileId: { type: 'string' },
          limit: { type: 'integer', minimum: 1 },
        },
      },
      RagSearchResponse: {
        type: 'object',
        required: ['results'],
        properties: {
          results: {
            type: 'array',
            items: { $ref: '#/components/schemas/RagResult' },
          },
        },
      },
      RagResult: {
        type: 'object',
        required: ['chunkIndex', 'content', 'fileId', 'fileName', 'score', 'vectorScore'],
        properties: {
          chunkIndex: { type: 'integer' },
          content: { type: 'string' },
          fileId: { type: 'string' },
          fileName: { type: 'string' },
          rerankScore: { type: ['number', 'null'] },
          score: { type: 'number' },
          vectorScore: { type: 'number' },
        },
      },
      RagChatRequest: {
        type: 'object',
        required: ['question'],
        properties: {
          question: { type: 'string' },
          fileId: { type: 'string' },
        },
      },
      RagChatResponse: {
        type: 'object',
        required: ['answer', 'citations', 'grounded', 'scope'],
        properties: {
          answer: { type: 'string' },
          citations: {
            type: 'array',
            items: { $ref: '#/components/schemas/RagCitation' },
          },
          grounded: { type: 'boolean' },
          scope: { $ref: '#/components/schemas/RagScope' },
        },
      },
      RagChatStreamEvent: {
        oneOf: [
          {
            type: 'object',
            required: ['text'],
            properties: {
              text: { type: 'string' },
            },
            description: 'Payload for `delta` events.',
          },
          {
            allOf: [{ $ref: '#/components/schemas/RagChatResponse' }],
            description: 'Payload for `done` events.',
          },
          {
            type: 'object',
            required: ['error'],
            properties: {
              error: { type: 'string' },
            },
            description: 'Payload for `error` events.',
          },
        ],
      },
      RagCitation: {
        type: 'object',
        required: ['fileId', 'fileName', 'position', 'score', 'type'],
        properties: {
          fileId: { type: 'string' },
          fileName: { type: 'string' },
          position: { type: 'string' },
          score: { type: 'number' },
          type: { type: 'string', enum: ['page'] },
        },
      },
      RagScope: {
        type: 'object',
        required: ['notebookId', 'notebookName'],
        properties: {
          fileId: { type: 'string' },
          fileName: { type: 'string' },
          notebookId: { type: 'string' },
          notebookName: { type: 'string' },
        },
      },
    },
  },
} as const;
