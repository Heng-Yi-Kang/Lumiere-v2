import { useEffect, useMemo, useState } from 'react';
import { getGenericUploadErrorMessage } from '../../lib/apiErrors';
import type { Notebook, PendingLink } from './types';
import { getPendingLinkStatusLabel } from './uploadProgress';

export function useNotebookLinks({
  notebook,
  onAddLink,
  onAddYoutubeLink,
  setUploadError,
}: {
  notebook: Notebook | null;
  onAddLink?: (notebookId: string, url: string) => Promise<void> | void;
  onAddYoutubeLink?: (notebookId: string, url: string) => Promise<void> | void;
  setUploadError: (error: string) => void;
}) {
  const [pendingLink, setPendingLink] = useState<PendingLink | null>(null);
  const [isAddLinkModalOpen, setIsAddLinkModalOpen] = useState(false);
  const [isAddYoutubeLinkModalOpen, setIsAddYoutubeLinkModalOpen] = useState(false);

  useEffect(() => {
    if (pendingLink?.status !== 'scraping') {
      return;
    }

    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const duration = pendingLink.kind === 'youtube' ? 12000 : 10000;
      const nextProgress = Math.min(94, 10 + Math.floor((elapsed / duration) * 84));
      setPendingLink((current) => current && current.status === 'scraping'
        ? { ...current, progress: Math.max(current.progress, nextProgress) }
        : current);
    }, 120);

    return () => window.clearInterval(intervalId);
  }, [pendingLink?.id, pendingLink?.kind, pendingLink?.status]);

  const pendingLinkStatusLabel = useMemo(() => getPendingLinkStatusLabel(pendingLink), [pendingLink]);
  const isPendingLinkActive = pendingLink?.status === 'scraping';
  const isWebLinkActive = isPendingLinkActive && pendingLink?.kind === 'web';
  const isYoutubeLinkActive = isPendingLinkActive && pendingLink?.kind === 'youtube';

  const handleAddLink = async (url: string) => {
    if (!notebook || !onAddLink) {
      return;
    }

    setUploadError('');
    setPendingLink({
      id: `web-link-${Date.now()}`,
      kind: 'web',
      progress: 8,
      status: 'scraping',
      url,
    });

    try {
      await Promise.resolve(onAddLink(notebook.id, url));
      setPendingLink((current) => current
        ? { ...current, progress: 100, status: 'done' }
        : current);
      window.setTimeout(() => {
        setPendingLink((current) => current?.status === 'done' ? null : current);
      }, 1200);
    } catch (error) {
      setUploadError(getGenericUploadErrorMessage(error));
      setPendingLink((current) => current
        ? { ...current, status: 'failed' }
        : current);
      throw error;
    }
  };

  const handleAddYoutubeLink = async (url: string) => {
    if (!notebook || !onAddYoutubeLink) {
      return;
    }

    setUploadError('');
    setPendingLink({
      id: `youtube-link-${Date.now()}`,
      kind: 'youtube',
      progress: 8,
      status: 'scraping',
      url,
    });

    try {
      await Promise.resolve(onAddYoutubeLink(notebook.id, url));
      setPendingLink((current) => current
        ? { ...current, progress: 100, status: 'done' }
        : current);
      window.setTimeout(() => {
        setPendingLink((current) => current?.status === 'done' ? null : current);
      }, 1200);
    } catch (error) {
      setUploadError(getGenericUploadErrorMessage(error));
      setPendingLink((current) => current
        ? { ...current, status: 'failed' }
        : current);
      throw error;
    }
  };

  return {
    actions: {
      handleAddLink,
      handleAddYoutubeLink,
      setIsAddLinkModalOpen,
      setIsAddYoutubeLinkModalOpen,
      setPendingLink,
    },
    state: {
      isAddLinkModalOpen,
      isAddYoutubeLinkModalOpen,
      isPendingLinkActive,
      isWebLinkActive,
      isYoutubeLinkActive,
      pendingLink,
      pendingLinkStatusLabel,
    },
  };
}
