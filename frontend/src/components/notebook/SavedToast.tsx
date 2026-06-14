import { BookmarkCheck, X } from 'lucide-react';

export function SavedToast({
  onDismiss,
}: {
  onDismiss: () => void;
}) {
  return (
    <div
      className="fixed bottom-6 right-6 z-[80] flex max-w-[calc(100vw-3rem)] items-center gap-3 rounded-2xl border border-success/25 bg-bg-overlay/95 px-4 py-3 text-sm font-bold text-text-primary shadow-2xl backdrop-blur-xl"
      role="status"
      aria-live="polite"
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-success/20 bg-success-subtle text-success">
        <BookmarkCheck className="h-4 w-4" />
      </span>
      <span>Chat saved</span>
      <button
        type="button"
        onClick={onDismiss}
        className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-text-muted transition hover:bg-bg-elevated hover:text-text-primary"
        title="Dismiss"
        aria-label="Dismiss saved chat notification"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
