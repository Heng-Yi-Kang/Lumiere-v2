import { getElapsedMs, logBackendProcess } from '@/lib/backend-logger';
import { getAuthenticatedUser } from '@/lib/auth';
import { prepareGroundedChat } from '@/lib/grounded-chat';
import { jsonResponse, optionsResponse, streamingJsonResponse, unauthorizedResponse } from '@/lib/http';
import { generateChatCompletion } from '@/lib/openai-chat';

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
    logBackendProcess('warn', 'rag.api.chat.rejected', {
      notebookId,
      reason: 'missing_question',
    });
    return jsonResponse({ error: 'question is required' }, { status: 400 });
  }

  logBackendProcess('info', 'rag.api.chat.started', {
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

  if (!chat.grounded) {
    return jsonResponse({
      answer: chat.answer,
      citations: chat.citations,
      grounded: false,
      scope: chat.scope,
    });
  }

  const completionStartedAt = performance.now();
  logBackendProcess('info', 'rag.chat_completion.started', {
    contextChunkCount: chat.citations.length,
    fileId: chat.scope.fileId,
    notebookId,
    scopeLabel: chat.scopeLabel,
  });

  return streamingJsonResponse((async () => {
    let answer;
    try {
      answer = await generateChatCompletion({
        context: chat.context,
        question,
        scopeLabel: chat.scopeLabel,
      });
    } catch (error) {
      logBackendProcess('error', 'rag.chat_completion.failed', {
        elapsedMs: getElapsedMs(completionStartedAt),
        error: error instanceof Error ? error.message : 'Unknown chat completion error',
        fileId: chat.scope.fileId,
        notebookId,
      });
      return { error: error instanceof Error ? error.message : 'Grounded chat generation failed.' };
    }

    logBackendProcess('info', 'rag.chat_completion.completed', {
      answerChars: answer.length,
      elapsedMs: getElapsedMs(completionStartedAt),
      fileId: chat.scope.fileId,
      notebookId,
    });

    logBackendProcess('info', 'rag.api.chat.completed', {
      elapsedMs: getElapsedMs(requestStartedAt),
      fileId: chat.scope.fileId,
      notebookId,
      resultCount: chat.citations.length,
    });

    return {
      answer,
      citations: chat.citations,
      grounded: true,
      scope: chat.scope,
    };
  })());
}
