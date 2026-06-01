import React, { useState } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import 'katex/dist/katex.min.css';

interface ChatMarkdownProps {
  content: string;
}

function getTextContent(children: React.ReactNode): string {
  if (typeof children === 'string' || typeof children === 'number') {
    return String(children);
  }

  if (Array.isArray(children)) {
    return children.map(getTextContent).join('');
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(children)) {
    return getTextContent(children.props.children);
  }

  return '';
}

function CopyableCodeBlock({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const language = className?.match(/language-(\w+)/)?.[1];
  const code = getTextContent(children).replace(/\n$/, '');

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="chat-code-block">
      <div className="chat-code-toolbar">
        <span>{language || 'code'}</span>
        <button type="button" onClick={copyCode}>
          {copied ? 'Copied' : 'Copy Code'}
        </button>
      </div>
      <pre>
        <code className={className}>{children}</code>
      </pre>
    </div>
  );
}

const markdownComponents: Components = {
  code({ className, children, ...props }) {
    const codeText = getTextContent(children);
    const isInline = !className && !codeText.includes('\n');

    if (isInline) {
      return (
        <code className="chat-inline-code" {...props}>
          {children}
        </code>
      );
    }

    return <CopyableCodeBlock className={className}>{children}</CopyableCodeBlock>;
  },
  a({ children, ...props }) {
    return (
      <a target="_blank" rel="noreferrer" {...props}>
        {children}
      </a>
    );
  },
};

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown
        remarkPlugins={[[remarkMath, { singleDollarTextMath: true }]]}
        rehypePlugins={[rehypeKatex, rehypeHighlight]}
        components={markdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
