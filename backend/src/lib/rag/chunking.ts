import { RAG_CHUNK_OVERLAP, RAG_CHUNK_SIZE } from '@/lib/rag/constants';
import type { RagIndexChunk } from '@/lib/rag/types';

type ChunkUnitType = 'code' | 'equation' | 'heading' | 'list' | 'page' | 'paragraph' | 'slide' | 'table';

type ChunkUnit = {
  endOffset: number;
  metadata: {
    pageNumber?: number;
    sectionTitle?: string;
    slideNumber?: number;
  };
  startOffset: number;
  text: string;
  type: ChunkUnitType;
};

function cleanText(text: string) {
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function estimateTokenCount(text: string) {
  const value = text.trim();

  if (!value) {
    return 0;
  }

  // Compatible with tokenizer behaviour closely enough for chunk sizing without
  // adding a runtime dependency: words undercount punctuation/code, chars cap CJK.
  const wordEstimate = value.split(/\s+/).filter(Boolean).length * 1.3;
  const charEstimate = value.length / 4;
  return Math.ceil(Math.max(wordEstimate, charEstimate));
}

function lineOffset(line: string, startOffset: number) {
  return {
    endOffset: startOffset + line.length,
    startOffset,
  };
}

function getHeadingTitle(line: string) {
  const markdownHeading = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);

  if (markdownHeading?.[1]) {
    return markdownHeading[1].trim();
  }

  return null;
}

function getPageNumber(line: string) {
  const match = line.match(/^\s*(?:-{2,}\s*)?(?:\[?\s*)page\s+(\d+)(?:\s*\]?)?(?:\s*-{2,})?\s*$/i);
  return match?.[1] ? Number(match[1]) : null;
}

function getSlideNumber(line: string) {
  const match = line.match(/^\s*(?:-{2,}\s*)?(?:\[?\s*)slide\s+(\d+)(?:\s*\]?)?(?:\s*-{2,})?\s*$/i);
  return match?.[1] ? Number(match[1]) : null;
}

function isBulletLine(line: string) {
  return /^\s*(?:[-*+]|\d+[.)])\s+\S/.test(line);
}

function isTableLine(line: string) {
  const trimmed = line.trim();
  return trimmed.includes('|') && trimmed.split('|').length >= 3;
}

function isEquationLine(line: string) {
  const trimmed = line.trim();
  return trimmed.startsWith('$$') || trimmed.endsWith('$$') || /^\\\[|\\\]$/.test(trimmed);
}

function buildUnit(
  lines: Array<{ endOffset: number; startOffset: number; text: string }>,
  type: ChunkUnitType,
  metadata: ChunkUnit['metadata'],
): ChunkUnit {
  const text = lines.map((line) => line.text).join('\n').trim();
  return {
    endOffset: lines[lines.length - 1]?.endOffset ?? 0,
    metadata: { ...metadata },
    startOffset: lines[0]?.startOffset ?? 0,
    text,
    type,
  };
}

function parseChunkUnits(text: string) {
  const normalized = text.replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n');
  const leadingWhitespace = normalized.match(/^\s*/)?.[0].length ?? 0;
  const source = cleanText(normalized);

  if (!source) {
    return [];
  }

  const lines = source.split('\n');
  const units: ChunkUnit[] = [];
  let cursor = leadingWhitespace;
  let pageNumber: number | undefined;
  let sectionTitle: string | undefined;
  let slideNumber: number | undefined;

  function metadata() {
    return {
      ...(pageNumber !== undefined ? { pageNumber } : {}),
      ...(sectionTitle ? { sectionTitle } : {}),
      ...(slideNumber !== undefined ? { slideNumber } : {}),
    };
  }

  for (let index = 0; index < lines.length;) {
    const line = lines[index] || '';
    const offsets = lineOffset(line, cursor);
    cursor += line.length + 1;

    if (!line.trim()) {
      index += 1;
      continue;
    }

    const headingTitle = getHeadingTitle(line);
    if (headingTitle) {
      sectionTitle = headingTitle;
      units.push(buildUnit([{ ...offsets, text: line }], 'heading', metadata()));
      index += 1;
      continue;
    }

    const nextPageNumber = getPageNumber(line);
    if (nextPageNumber !== null) {
      pageNumber = nextPageNumber;
      units.push(buildUnit([{ ...offsets, text: line }], 'page', metadata()));
      index += 1;
      continue;
    }

    const nextSlideNumber = getSlideNumber(line);
    if (nextSlideNumber !== null) {
      slideNumber = nextSlideNumber;
      units.push(buildUnit([{ ...offsets, text: line }], 'slide', metadata()));
      index += 1;
      continue;
    }

    if (line.trim().startsWith('```')) {
      const block = [{ ...offsets, text: line }];
      index += 1;
      while (index < lines.length) {
        const blockLine = lines[index] || '';
        const blockOffsets = lineOffset(blockLine, cursor);
        cursor += blockLine.length + 1;
        block.push({ ...blockOffsets, text: blockLine });
        index += 1;

        if (blockLine.trim().startsWith('```')) {
          break;
        }
      }
      units.push(buildUnit(block, 'code', metadata()));
      continue;
    }

    if (isBulletLine(line)) {
      const block = [{ ...offsets, text: line }];
      index += 1;
      while (index < lines.length && (isBulletLine(lines[index] || '') || /^\s{2,}\S/.test(lines[index] || ''))) {
        const blockLine = lines[index] || '';
        const blockOffsets = lineOffset(blockLine, cursor);
        cursor += blockLine.length + 1;
        block.push({ ...blockOffsets, text: blockLine });
        index += 1;
      }
      units.push(buildUnit(block, 'list', metadata()));
      continue;
    }

    if (isTableLine(line)) {
      const block = [{ ...offsets, text: line }];
      index += 1;
      while (index < lines.length && isTableLine(lines[index] || '')) {
        const blockLine = lines[index] || '';
        const blockOffsets = lineOffset(blockLine, cursor);
        cursor += blockLine.length + 1;
        block.push({ ...blockOffsets, text: blockLine });
        index += 1;
      }
      units.push(buildUnit(block, 'table', metadata()));
      continue;
    }

    if (isEquationLine(line)) {
      const block = [{ ...offsets, text: line }];
      index += 1;
      while (index < lines.length && !isEquationLine(lines[index] || '')) {
        const blockLine = lines[index] || '';
        const blockOffsets = lineOffset(blockLine, cursor);
        cursor += blockLine.length + 1;
        block.push({ ...blockOffsets, text: blockLine });
        index += 1;
      }
      if (index < lines.length) {
        const blockLine = lines[index] || '';
        const blockOffsets = lineOffset(blockLine, cursor);
        cursor += blockLine.length + 1;
        block.push({ ...blockOffsets, text: blockLine });
        index += 1;
      }
      units.push(buildUnit(block, 'equation', metadata()));
      continue;
    }

    const block = [{ ...offsets, text: line }];
    index += 1;
    while (index < lines.length && lines[index]?.trim()) {
      const paragraphLine = lines[index] || '';

      if (
        getHeadingTitle(paragraphLine)
        || getPageNumber(paragraphLine) !== null
        || getSlideNumber(paragraphLine) !== null
        || paragraphLine.trim().startsWith('```')
        || isBulletLine(paragraphLine)
        || isTableLine(paragraphLine)
        || isEquationLine(paragraphLine)
      ) {
        break;
      }

      const paragraphOffsets = lineOffset(paragraphLine, cursor);
      cursor += paragraphLine.length + 1;
      block.push({ ...paragraphOffsets, text: paragraphLine });
      index += 1;
    }
    units.push(buildUnit(block, 'paragraph', metadata()));
  }

  return units;
}

function splitParagraphUnit(unit: ChunkUnit, maxTokens: number): ChunkUnit[] {
  const sentences = unit.text.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g)?.map((value) => value.trim()).filter(Boolean) || [unit.text];

  if (sentences.length <= 1) {
    return [unit];
  }

  const units: ChunkUnit[] = [];
  let searchOffset = unit.startOffset;

  for (const sentence of sentences) {
    const sentenceStart = Math.max(unit.startOffset, unit.text.indexOf(sentence, searchOffset - unit.startOffset) + unit.startOffset);
    const sentenceEnd = sentenceStart + sentence.length;
    searchOffset = sentenceEnd;

    if (estimateTokenCount(sentence) > maxTokens) {
      const words = sentence.split(/\s+/).filter(Boolean);
      let current = '';
      let currentStart = sentenceStart;

      for (const word of words) {
        const candidate = `${current} ${word}`.trim();
        if (current && estimateTokenCount(candidate) > maxTokens) {
          units.push({
            ...unit,
            endOffset: currentStart + current.length,
            startOffset: currentStart,
            text: current,
          });
          currentStart = sentenceStart + sentence.indexOf(word, Math.max(0, currentStart - sentenceStart));
          current = word;
          continue;
        }
        current = candidate;
      }

      if (current) {
        units.push({
          ...unit,
          endOffset: currentStart + current.length,
          startOffset: currentStart,
          text: current,
        });
      }
      continue;
    }

    units.push({
      ...unit,
      endOffset: sentenceEnd,
      startOffset: sentenceStart,
      text: sentence,
    });
  }

  return units;
}

function formatUnits(units: ChunkUnit[]) {
  return units.map((unit) => unit.text).join('\n\n').trim();
}

function buildChunk(units: ChunkUnit[]): RagIndexChunk | null {
  const content = formatUnits(units);

  if (!content) {
    return null;
  }

  const metadata = units.reduce<Record<string, unknown>>((accumulator, unit) => ({
    ...accumulator,
    ...unit.metadata,
  }), {});

  return {
    content,
    metadata: {
      ...metadata,
      sourceEndOffset: Math.max(...units.map((unit) => unit.endOffset)),
      sourceStartOffset: Math.min(...units.map((unit) => unit.startOffset)),
    },
  };
}

function takeOverlapUnits(units: ChunkUnit[], overlapTokens: number) {
  if (!overlapTokens) {
    return [];
  }

  const overlapUnits: ChunkUnit[] = [];
  let tokens = 0;

  for (let index = units.length - 1; index >= 0; index -= 1) {
    const unit = units[index];
    if (!unit) {
      continue;
    }

    const nextTokens = tokens + estimateTokenCount(unit.text);
    if (overlapUnits.length && nextTokens > overlapTokens) {
      break;
    }

    overlapUnits.unshift(unit);
    tokens = nextTokens;
  }

  return overlapUnits;
}

function normalizeChunkTokenCount(value: number, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback;
}

export function splitIntoRagChunks(text: string, chunkSize = RAG_CHUNK_SIZE, overlap = RAG_CHUNK_OVERLAP): RagIndexChunk[] {
  const targetTokens = normalizeChunkTokenCount(chunkSize, RAG_CHUNK_SIZE);
  const overlapTokens = Math.min(normalizeChunkTokenCount(overlap, RAG_CHUNK_OVERLAP), Math.floor(targetTokens / 2));
  const maxTokens = Math.max(targetTokens, Math.ceil(targetTokens * 1.25));
  const units = parseChunkUnits(text).flatMap((unit) =>
    unit.type === 'paragraph' && estimateTokenCount(unit.text) > maxTokens
      ? splitParagraphUnit(unit, maxTokens)
      : [unit],
  );
  const chunks: RagIndexChunk[] = [];
  let currentUnits: ChunkUnit[] = [];

  function flush() {
    const chunk = buildChunk(currentUnits);
    if (chunk) {
      chunks.push(chunk);
      currentUnits = takeOverlapUnits(currentUnits, overlapTokens);
      return;
    }
    currentUnits = [];
  }

  for (const unit of units) {
    const isStructuralBoundary = unit.type === 'heading' || unit.type === 'page' || unit.type === 'slide';
    const hasContentBeforeBoundary = currentUnits.some((currentUnit) =>
      currentUnit.type !== 'page' && currentUnit.type !== 'slide',
    );
    const candidateUnits = [...currentUnits, unit];
    const candidateTokens = estimateTokenCount(formatUnits(candidateUnits));

    if (isStructuralBoundary && hasContentBeforeBoundary) {
      flush();
    } else if (currentUnits.length && candidateTokens > maxTokens) {
      flush();
    }

    currentUnits.push(unit);
  }

  flush();
  return chunks;
}

export function splitIntoChunks(text: string, chunkSize = RAG_CHUNK_SIZE, overlap = RAG_CHUNK_OVERLAP) {
  return splitIntoRagChunks(text, chunkSize, overlap).map((chunk) => chunk.content);
}
