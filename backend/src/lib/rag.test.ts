import { splitIntoChunks } from './rag';

describe('splitIntoChunks', () => {
  it('chunks text with overlap from prior content', () => {
    const text = [
      'First paragraph has enough words to begin a useful chunk for retrieval.',
      'Second paragraph continues the uploaded material with more searchable content.',
      'Third paragraph gives the splitter enough text to form another chunk.',
    ].join('\n\n');

    const chunks = splitIntoChunks(text, 90, 25);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.trim().length > 0)).toBe(true);
    expect(chunks[1]).toContain('retrieval');
  });
});
