import React, { useEffect, useState } from 'react';
import { LoaderCircle, X, Youtube } from 'lucide-react';
import { LabeledProgressBar } from './ProgressBar';
import { getGenericUploadErrorMessage } from '../lib/apiErrors';

interface AddYoutubeLinkModalProps {
  disabled?: boolean;
  notebookName?: string;
  onClose: () => void;
  onSubmit: (url: string) => Promise<void> | void;
}

function validateYoutubeLink(value: string) {
  let parsed: URL;

  try {
    parsed = new URL(value.trim());
  } catch {
    return 'Enter a valid YouTube URL.';
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Only http and https YouTube URLs are supported.';
  }

  const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '');
  if (host !== 'youtube.com' && host !== 'youtu.be') {
    return 'Enter a YouTube URL from youtube.com or youtu.be.';
  }

  return null;
}

export default function AddYoutubeLinkModal({
  disabled,
  notebookName,
  onClose,
  onSubmit,
}: AddYoutubeLinkModalProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationProgress, setValidationProgress] = useState(0);

  useEffect(() => {
    if (!isSubmitting) {
      return;
    }

    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const nextProgress = Math.min(94, 12 + Math.floor((elapsed / 12000) * 82));
      setValidationProgress((currentProgress) => Math.max(currentProgress, nextProgress));
    }, 120);

    return () => window.clearInterval(intervalId);
  }, [isSubmitting]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (disabled || isSubmitting) {
      return;
    }

    const validationError = validateYoutubeLink(url);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError('');
    setIsSubmitting(true);
    setValidationProgress(8);

    try {
      await Promise.resolve(onSubmit(url.trim()));
      setValidationProgress(100);
      await new Promise((resolve) => window.setTimeout(resolve, 300));
      onClose();
    } catch (submitError) {
      setError(getGenericUploadErrorMessage(submitError));
      setIsSubmitting(false);
      setValidationProgress(0);
    }
  };

  const validationStatus = validationProgress >= 100
    ? 'Video validated. Adding it to the notebook queue...'
    : validationProgress >= 70
      ? 'Confirming transcript and media availability...'
      : validationProgress >= 36
        ? 'Fetching video metadata...'
        : 'Validating YouTube video...';

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
              <Youtube className="h-5 w-5 text-cta" />
              Add YouTube Video
            </div>
            <p className="mt-1 text-xs text-text-secondary">
              {notebookName ? `Download and index a public video into ${notebookName}.` : 'Download and index a public video into the selected notebook.'}
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

        <label htmlFor="youtube-link-url" className="mt-5 block text-[10px] font-black uppercase tracking-[0.14em] text-text-muted font-mono">
          YouTube URL
        </label>
        <div className="mt-2 flex items-center gap-2 rounded-2xl border border-border-default bg-bg-elevated/50 px-3 py-2.5 focus-within:border-accent">
          <Youtube className="h-4 w-4 shrink-0 text-text-muted" />
          <input
            id="youtube-link-url"
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
            disabled={disabled || isSubmitting}
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-text-primary outline-none placeholder:text-text-muted disabled:cursor-not-allowed"
          />
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl border border-cta/20 bg-cta-subtle px-4 py-3 text-sm font-semibold text-cta">
            {error}
          </div>
        ) : null}

        {isSubmitting ? (
          <div className="mt-3 rounded-2xl border border-border-subtle bg-bg-elevated/40 px-4 py-3 text-sm text-text-secondary">
            <LabeledProgressBar
              value={validationProgress}
              label={validationStatus}
              ariaLabel="YouTube video validation progress"
              className="mt-3 h-2"
              tone="cta"
              indicatorClassName="duration-150"
              valueClassName="text-cta"
            />
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
            className="inline-flex items-center gap-2 rounded-xl border border-cta/20 bg-cta-subtle px-4 py-2.5 text-xs font-bold text-cta transition hover:bg-cta/20 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {isSubmitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Youtube className="h-4 w-4" />}
            {isSubmitting ? 'Adding...' : 'Add Video'}
          </button>
        </div>
      </form>
    </div>
  );
}
