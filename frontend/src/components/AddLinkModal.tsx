import React, { useState } from 'react';
import { ExternalLink, Link as LinkIcon, LoaderCircle, X } from 'lucide-react';
import { getGenericUploadErrorMessage } from '../lib/apiErrors';

interface AddLinkModalProps {
  disabled?: boolean;
  notebookName?: string;
  onClose: () => void;
  onSubmit: (url: string) => Promise<void> | void;
}

function validateWebLink(value: string) {
  let parsed: URL;

  try {
    parsed = new URL(value.trim());
  } catch {
    return 'Enter a valid web link.';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Only http and https web links are supported.';
  }

  return null;
}

export default function AddLinkModal({
  disabled,
  notebookName,
  onClose,
  onSubmit,
}: AddLinkModalProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (disabled || isSubmitting) {
      return;
    }

    const validationError = validateWebLink(url);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      await Promise.resolve(onSubmit(url.trim()));
      onClose();
    } catch (submitError) {
      setError(getGenericUploadErrorMessage(submitError));
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!isSubmitting) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-lg rounded-3xl border border-border-default bg-bg-overlay p-5 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-black text-text-primary font-display">
              <LinkIcon className="h-5 w-5 text-accent-hover" />
              Add Web Link
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              {notebookName ? `Scrape a page into ${notebookName}.` : 'Scrape a page into the selected notebook.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full border border-border-default bg-bg-elevated/70 p-2 text-text-secondary transition hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label htmlFor="web-link-url" className="mt-5 block text-[10px] font-black uppercase tracking-[0.14em] text-text-muted font-mono">
          Web page URL
        </label>
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-border-default bg-bg-elevated/50 px-3 py-2.5 focus-within:border-accent">
          <ExternalLink className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            id="web-link-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://example.com/article"
            disabled={disabled || isSubmitting}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-text-primary outline-none placeholder:text-text-muted disabled:cursor-not-allowed"
          />
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl border border-cta/20 bg-cta-subtle px-4 py-3 text-sm font-semibold text-cta">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-border-default bg-bg-elevated/50 px-4 py-2.5 text-xs font-bold text-text-secondary transition hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={disabled || isSubmitting}
            className="inline-flex items-center gap-2 rounded-xl border border-accent-border bg-accent-subtle px-4 py-2.5 text-xs font-bold text-accent-hover transition hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <LinkIcon className="h-4 w-4" />}
            {isSubmitting ? 'Scraping...' : 'Add Link'}
          </button>
        </div>
      </form>
    </div>
  );
}
