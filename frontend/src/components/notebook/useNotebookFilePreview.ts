import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { fetchNotebookFilePreview } from '../../lib/notebooksApi';
import type { FileItem, Notebook } from './types';
import type { NotebookFilePreview } from '../../types';
import {
  hasPendingFileWork,
  SELECTED_FILE_REFRESH_INTERVAL_MS,
} from './notebookHelpers';

export function useNotebookFilePreview({
  notebook,
  selectedMaterial,
  setSelectedMaterial,
}: {
  notebook: Notebook | null;
  selectedMaterial: FileItem | null;
  setSelectedMaterial: Dispatch<SetStateAction<FileItem | null>>;
}) {
  const [previewCache, setPreviewCache] = useState<Record<string, NotebookFilePreview>>({});
  const [previewError, setPreviewError] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    if (!notebook || !selectedMaterial) {
      return;
    }

    if (previewCache[selectedMaterial.id]) {
      return;
    }

    let isActive = true;
    setPreviewLoading(true);
    setPreviewError('');

    void fetchNotebookFilePreview(notebook.id, selectedMaterial.id)
      .then((preview) => {
        if (!isActive) {
          return;
        }

        setPreviewCache((current) => ({
          ...current,
          [selectedMaterial.id]: preview,
        }));
      })
      .catch((error) => {
        if (!isActive) {
          return;
        }

        setPreviewError(error instanceof Error ? error.message : 'Failed to load file preview.');
      })
      .finally(() => {
        if (isActive) {
          setPreviewLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [notebook, previewCache, selectedMaterial]);

  useEffect(() => {
    if (!selectedMaterial) {
      return;
    }

    setPreviewCache((current) => {
      const preview = current[selectedMaterial.id];

      if (!preview) {
        return current;
      }

      const nextPreview = {
        ...preview,
        hlsGeneratedAt: selectedMaterial.hlsGeneratedAt,
        hlsMasterPlaylistUrl: selectedMaterial.hlsMasterPlaylistUrl,
        hlsStatus: selectedMaterial.hlsStatus,
        ingestionError: selectedMaterial.ingestionError,
        name: selectedMaterial.name,
        summary: selectedMaterial.summary,
        summaryError: selectedMaterial.summaryError,
        summaryGeneratedAt: selectedMaterial.summaryGeneratedAt,
        summaryStatus: selectedMaterial.summaryStatus,
        status: selectedMaterial.status,
        videoDurationSeconds: selectedMaterial.videoDurationSeconds,
        videoResolution: selectedMaterial.videoResolution,
      };

      const didChange =
        preview.hlsGeneratedAt !== nextPreview.hlsGeneratedAt ||
        preview.hlsMasterPlaylistUrl !== nextPreview.hlsMasterPlaylistUrl ||
        preview.hlsStatus !== nextPreview.hlsStatus ||
        preview.ingestionError !== nextPreview.ingestionError ||
        preview.name !== nextPreview.name ||
        preview.summary !== nextPreview.summary ||
        preview.summaryError !== nextPreview.summaryError ||
        preview.summaryGeneratedAt !== nextPreview.summaryGeneratedAt ||
        preview.summaryStatus !== nextPreview.summaryStatus ||
        preview.status !== nextPreview.status ||
        preview.videoDurationSeconds !== nextPreview.videoDurationSeconds ||
        preview.videoResolution !== nextPreview.videoResolution;

      if (!didChange) {
        return current;
      }

      return {
        ...current,
        [selectedMaterial.id]: nextPreview,
      };
    });
  }, [selectedMaterial]);

  useEffect(() => {
    if (!notebook || !selectedMaterial) {
      return;
    }

    const cachedPreview = previewCache[selectedMaterial.id];
    const shouldRefreshSelectedFile = hasPendingFileWork(cachedPreview) || hasPendingFileWork(selectedMaterial);

    if (!shouldRefreshSelectedFile) {
      return;
    }

    let isActive = true;
    let timeoutId: number | undefined;

    const refreshSelectedFile = () => {
      void fetchNotebookFilePreview(notebook.id, selectedMaterial.id)
        .then((preview) => {
          if (!isActive) {
            return;
          }

          setPreviewCache((current) => ({
            ...current,
            [selectedMaterial.id]: preview,
          }));
          setPreviewError('');

          if (hasPendingFileWork(preview)) {
            timeoutId = window.setTimeout(refreshSelectedFile, SELECTED_FILE_REFRESH_INTERVAL_MS);
          }
        })
        .catch((error) => {
          if (!isActive) {
            return;
          }

          setPreviewError(error instanceof Error ? error.message : 'Failed to refresh file preview.');
          timeoutId = window.setTimeout(refreshSelectedFile, SELECTED_FILE_REFRESH_INTERVAL_MS);
        });
    };

    timeoutId = window.setTimeout(refreshSelectedFile, SELECTED_FILE_REFRESH_INTERVAL_MS);

    return () => {
      isActive = false;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [notebook, previewCache, selectedMaterial]);

  useEffect(() => {
    if (!notebook || !selectedMaterial) {
      return;
    }

    const refreshedFile = notebook.files.find((file) => file.id === selectedMaterial.id);
    if (refreshedFile && refreshedFile !== selectedMaterial) {
      setSelectedMaterial(refreshedFile);
    }
  }, [notebook, selectedMaterial, setSelectedMaterial]);

  const activePreview = selectedMaterial ? previewCache[selectedMaterial.id] : undefined;

  return {
    actions: {
      setPreviewCache,
      setPreviewError,
    },
    state: {
      activePreview,
      previewCache,
      previewError,
      previewLoading,
    },
  };
}
