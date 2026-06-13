import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import { getAuthenticatedUser } from '@/lib/auth';
import { prepareGroundedChat } from '@/lib/grounded-chat';
import { applyCorsHeaders, jsonResponse, optionsResponse, unauthorizedResponse } from '@/lib/http';
import { streamChatCompletion } from '@/lib/openai-chat';

function encodeSseEvent(encoder: TextEncoder, event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function OPTIONS() {
  return optionsResponse();
}

export async function POST(
  request: Request,
  context: { params: Promise<{ notebookId: string }> },
) {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const requestStartedAt = performance.now();
  const { notebookId } = await context.params;
  const body = await request.json().catch(() => null) as {
    fileId?: string;
    question?: string;
  } | null;
  const question = body?.question?.trim();

  if (!question) {
    logBackendProcess('warn', 'rag.api.chat.stream.rejected', {
      notebookId,
      reason: 'missing_question',
    });
    return jsonResponse({ error: 'question is required' }, { status: 400 });
  }

  logBackendProcess('info', 'rag.api.chat.stream.started', {
    fileId: body?.fileId,
    notebookId,
    questionChars: question.length,
  });

  const prepared = await prepareGroundedChat({
    fileId: body?.fileId,
    notebookId,
    question,
    requestStartedAt,
    user,
  });

  if (prepared.error) {
    return jsonResponse(prepared.error.body, { status: prepared.error.status });
  }

  const chat = prepared.result;
  const encoder = new TextEncoder();
  const headers = applyCorsHeaders(new Headers({
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'Content-Type': 'text/event-stream; charset=utf-8',
    'X-Accel-Buffering': 'no',
  }));

  const stream = new ReadableStream({
    async start(controller) {
      if (!chat.grounded) {
        controller.enqueue(encodeSseEvent(encoder, 'done', {
          answer: chat.answer,
          citations: chat.citations,
          grounded: false,
          scope: chat.scope,
        }));
        controller.close();
        return;
      }

      const completionStartedAt = performance.now();
      logBackendProcess('info', 'rag.chat_completion.stream.started', {
        contextChunkCount: chat.citations.length,
        fileId: chat.scope.fileId,
        notebookId,
        scopeLabel: chat.scopeLabel,
      });

      try {
        const answer = await streamChatCompletion({
          context: chat.context,
          onDelta: (text) => {
            controller.enqueue(encodeSseEvent(encoder, 'delta', { text }));
          },
          question,
          scopeLabel: chat.scopeLabel,
        });

        logBackendProcess('info', 'rag.chat_completion.stream.completed', {
          answerChars: answer.length,
          elapsedMs: getElapsedMs(completionStartedAt),
          fileId: chat.scope.fileId,
          notebookId,
        });

        logBackendProcess('info', 'rag.api.chat.stream.completed', {
          elapsedMs: getElapsedMs(requestStartedAt),
          fileId: chat.scope.fileId,
          notebookId,
          resultCount: chat.citations.length,
        });

        controller.enqueue(encodeSseEvent(encoder, 'done', {
          answer,
          citations: chat.citations,
          grounded: true,
          scope: chat.scope,
        }));
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Grounded chat generation failed.';
        logBackendProcess('error', 'rag.chat_completion.stream.failed', {
          elapsedMs: getElapsedMs(completionStartedAt),
          error: errorMessage,
          fileId: chat.scope.fileId,
          notebookId,
        });
        controller.enqueue(encodeSseEvent(encoder, 'error', { error: errorMessage }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers,
  });
}
