import React, { useCallback, useRef, useState } from 'react';
import { Bold, Italic, List, ListOrdered, Heading, Eye, EyeOff } from 'lucide-react';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

function insertAtCursor(
  textarea: HTMLTextAreaElement,
  before: string,
  after: string,
) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.slice(start, end);
  const replacement = `${before}${selected}${after}`;
  textarea.setRangeText(replacement, start, end, 'end');
  textarea.selectionStart = start + before.length;
  textarea.selectionEnd = end + before.length;
  textarea.focus();
  return textarea.value.slice(0, start) + replacement + text.slice(end);
}

export function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listBuffer: { content: string; ordered: boolean }[] = [];
  let keyIndex = 0;

  const flushList = () => {
    if (listBuffer.length === 0) return;
    const isOrdered = listBuffer[0].ordered;
    const items = listBuffer.map((item, i) => (
      <li key={`li-${keyIndex++}-${i}`} className="ml-4 leading-relaxed">
        {parseInline(item.content)}
      </li>
    ));
    if (isOrdered) {
      elements.push(
        <ol key={`ol-${keyIndex++}`} className="list-decimal space-y-1 my-2">
          {items}
        </ol>,
      );
    } else {
      elements.push(
        <ul key={`ul-${keyIndex++}`} className="list-disc space-y-1 my-2">
          {items}
        </ul>,
      );
    }
    listBuffer = [];
  };

  const parseInline = (line: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    let remaining = line;
    let idx = 0;

    const pushMatch = (
      pattern: RegExp,
      render: (content: string) => React.ReactNode,
    ) => {
      const match = remaining.match(pattern);
      if (match && match.index !== undefined) {
        if (match.index > 0) {
          parts.push(<span key={`t-${idx++}`}>{remaining.slice(0, match.index)}</span>);
        }
        parts.push(render(match[1]));
        remaining = remaining.slice(match.index + match[0].length);
        return true;
      }
      return false;
    };

    while (remaining.length > 0) {
      const before = remaining;
      if (pushMatch(/\*\*(.+?)\*\*/, (content) => (
        <strong key={`b-${idx++}`} className="font-bold text-text-primary">{parseInline(content)}</strong>
      ))) continue;
      if (pushMatch(/__(.+?)__/, (content) => (
        <strong key={`b2-${idx++}`} className="font-bold text-text-primary">{parseInline(content)}</strong>
      ))) continue;
      if (pushMatch(/\*(.+?)\*/, (content) => (
        <em key={`i-${idx++}`} className="italic text-text-secondary">{parseInline(content)}</em>
      ))) continue;
      if (pushMatch(/_(.+?)_/, (content) => (
        <em key={`i2-${idx++}`} className="italic text-text-secondary">{parseInline(content)}</em>
      ))) continue;
      if (pushMatch(/`(.+?)`/, (content) => (
        <code key={`c-${idx++}`} className="rounded bg-bg-elevated px-1 py-0.5 text-xs font-mono text-accent-hover border border-border-subtle">{content}</code>
      ))) continue;

      if (remaining === before) {
        parts.push(<span key={`t-${idx++}`}>{remaining}</span>);
        break;
      }
    }

    return <>{parts}</>;
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    const unorderedMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    const orderedMatch = line.match(/^(\s*)\d+\.\s+(.*)$/);

    if (headingMatch) {
      flushList();
      const level = headingMatch[1].length;
      const content = headingMatch[2];
      const Tag = `h${level}` as React.ElementType;
      const sizeClass =
        level === 1
          ? 'text-lg'
          : level === 2
            ? 'text-base'
            : 'text-sm';
      elements.push(
        <Tag
          key={`h-${keyIndex++}`}
          className={`${sizeClass} font-black text-text-primary mt-3 mb-1 font-display`}
        >
          {parseInline(content)}
        </Tag>,
      );
    } else if (unorderedMatch) {
      listBuffer.push({ content: unorderedMatch[2], ordered: false });
    } else if (orderedMatch) {
      listBuffer.push({ content: orderedMatch[2], ordered: true });
    } else if (line.trim() === '') {
      flushList();
    } else {
      flushList();
      elements.push(
        <p key={`p-${keyIndex++}`} className="text-sm leading-relaxed text-text-secondary font-serif">
          {parseInline(line)}
        </p>,
      );
    }
  }

  flushList();
  return elements;
}

export default function MarkdownEditor({ value, onChange, placeholder }: MarkdownEditorProps) {
  const [isPreview, setIsPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTool = useCallback(
    (before: string, after: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const next = insertAtCursor(el, before, after);
      onChange(next);
    },
    [onChange],
  );

  const tools = [
    { icon: Bold, label: 'Bold', before: '**', after: '**' },
    { icon: Italic, label: 'Italic', before: '*', after: '*' },
    { icon: Heading, label: 'Heading', before: '## ', after: '' },
    { icon: List, label: 'Bullet list', before: '- ', after: '' },
    { icon: ListOrdered, label: 'Numbered list', before: '1. ', after: '' },
  ];

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border-subtle bg-bg-elevated/40 overflow-hidden">
      <div className="flex items-center justify-between gap-2 border-b border-border-subtle bg-bg-elevated/60 px-3 py-2">
        <div className="flex items-center gap-1">
          {tools.map((tool) => (
            <button
              key={tool.label}
              type="button"
              onClick={() => handleTool(tool.before, tool.after)}
              title={tool.label}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border-default bg-bg-elevated/60 text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
            >
              <tool.icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setIsPreview((p) => !p)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border-default bg-bg-elevated/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-text-secondary transition hover:bg-bg-overlay hover:text-text-primary"
        >
          {isPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          {isPreview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {isPreview ? (
        <div className="min-h-[120px] max-h-[320px] overflow-y-auto p-3 space-y-1">
          {value.trim() ? renderMarkdown(value) : (
            <p className="text-sm text-text-muted italic">Nothing to preview</p>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="min-h-[120px] max-h-[320px] flex-1 resize-y bg-transparent p-3 text-xs font-semibold leading-relaxed text-text-primary outline-none placeholder:text-text-muted font-mono"
        />
      )}
    </div>
  );
}
