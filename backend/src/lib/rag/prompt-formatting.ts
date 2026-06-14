import { RAG_PROMPT_SOURCE_CHAR_LIMIT } from '@/lib/rag/constants';
import type { RagSearchResult } from '@/lib/rag/types';

export function formatRagContextForPrompt(results: RagSearchResult[]) {
  return results
    .map((result, index) => {
      const content = result.content.length > RAG_PROMPT_SOURCE_CHAR_LIMIT
        ? `${result.content.slice(0, RAG_PROMPT_SOURCE_CHAR_LIMIT).trimEnd()}\n[Source excerpt truncated]`
        : result.content;

      return [
        [
          `[SOURCE ${index + 1}: ${result.fileName}, chunk ${result.chunkIndex + 1}, score ${result.score.toFixed(3)}`,
          `vectorScore ${result.vectorScore.toFixed(3)}`,
          `rerankScore ${result.rerankScore === null ? 'n/a' : result.rerankScore.toFixed(3)}]`,
        ].join(', '),
        content,
      ].join('\n');
    })
    .join('\n\n');
}
