import { useEffect, useMemo, useRef, useState } from 'react';
import AddLinkModal from './AddLinkModal';
import AddYoutubeLinkModal from './AddYoutubeLinkModal';
import { useFileNotes } from '../hooks/useFileNotes';
import { getNotebookColorTone } from '../lib/notebookColors';
import type { FileItem, NotebookViewProps, NotebookPanelTab, FileDetailTab } from './notebook/types';
import { AllNotebooksView } from './notebook/AllNotebooksView';
import { FilePreviewDrawer } from './notebook/FilePreviewDrawer';
import { MaterialsDirectory } from './notebook/MaterialsDirectory';
import {
  DeleteMaterialModal,
  DeleteNotebookModal,
  RenameMaterialModal,
} from './notebook/NotebookModals';
import { NotebookHeader } from './notebook/NotebookHeader';
import { NotebookStudyPanel } from './notebook/NotebookStudyPanel';
import { SavedToast } from './notebook/SavedToast';
import {
  countMatchingFiles,
  fileMatchesSearch,
  getViewerUrl,
  normalizeSearchValue,
  notebookMatchesSearch,
} from './notebook/notebookHelpers';
import { useFileScopedChat } from './notebook/useFileScopedChat';
import { useNotebookFilePreview } from './notebook/useNotebookFilePreview';
import { useNotebookLinks } from './notebook/useNotebookLinks';
import { useNotebookMaterialActions } from './notebook/useNotebookMaterialActions';
import { useNotebookUploads } from './notebook/useNotebookUploads';
import { useSavedNotebookReplies } from './notebook/useSavedNotebookReplies';

export type { NotebookViewProps };

export default function NotebookView({
  notebook,
  allNotebooks,
  searchQuery = '',
  onSelectNotebook,
  onBackToDashboard,
  onAddLink,
  onAddYoutubeLink,
  onUploadFile,
  onDeleteFile,
  onRetryFileSummary,
  onRenameFile,
  onEditNotebook,
  onDeleteNotebook,
  onCreateNotebookRequested,
}: NotebookViewProps) {
  const [selectedMaterial, setSelectedMaterial] = useState<FileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeletingNotebook, setIsDeletingNotebook] = useState(false);
  const [pendingDeleteFile, setPendingDeleteFile] = useState<FileItem | null>(null);
  const [pendingRenameFile, setPendingRenameFile] = useState<FileItem | null>(null);
  const [renameFileName, setRenameFileName] = useState('');
  const [renameError, setRenameError] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleteNotebookModalOpen, setIsDeleteNotebookModalOpen] = useState(false);
  const [notebookPanelTab, setNotebookPanelTab] = useState<NotebookPanelTab>('chat');
  const [isSummaryOpen, setIsSummaryOpen] = useState(true);
  const [summaryRetryError, setSummaryRetryError] = useState('');
  const [retryingSummaryFileId, setRetryingSummaryFileId] = useState<string | null>(null);
  const [fileDetailTab, setFileDetailTab] = useState<FileDetailTab>('chat');
  const [videoIngestionProgress, setVideoIngestionProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileChatScrollRef = useRef<HTMLDivElement | null>(null);
  const saveToastTimeoutRef = useRef<number | null>(null);

  const fileNoteApi = useFileNotes(notebook?.id, selectedMaterial?.id);
  const normalizedSearchQuery = normalizeSearchValue(searchQuery);
  const isSearchActive = Boolean(normalizedSearchQuery);
  const colorTone = notebook ? getNotebookColorTone(notebook.color) : null;

  const {
    actions: previewActions,
    state: previewState,
  } = useNotebookFilePreview({
    notebook,
    selectedMaterial,
    setSelectedMaterial,
  });

  const {
    actions: uploadActions,
    state: uploadState,
  } = useNotebookUploads({
    fileInputRef,
    notebook,
    onUploadFile,
  });

  const {
    actions: linkActions,
    state: linkState,
  } = useNotebookLinks({
    notebook,
    onAddLink,
    onAddYoutubeLink,
    setUploadError: uploadActions.setUploadError,
  });

  const {
    actions: savedReplyActions,
    state: savedReplyState,
  } = useSavedNotebookReplies({
    notebook,
    saveToastTimeoutRef,
  });

  const activePreview = previewState.activePreview;
  const selectedViewerUrl = getViewerUrl(activePreview?.sourceUrl);
  const fileStatus = activePreview?.status || selectedMaterial?.status || 'ready';
  const ingestionError = activePreview?.ingestionError || selectedMaterial?.ingestionError;
  const isVideoPreview = selectedMaterial?.type === 'video';
  const isImagePreview = selectedMaterial?.type === 'image';
  const isVideoIngestionProcessing = isVideoPreview && fileStatus === 'processing';
  const isVideoIngestionError = isVideoPreview && fileStatus === 'error';
  const isVideoIngestionUnavailable = isVideoIngestionProcessing || isVideoIngestionError;

  const {
    actions: fileChatActions,
    state: fileChatState,
  } = useFileScopedChat({
    fileChatScrollRef,
    isVideoIngestionUnavailable,
    notebook,
    selectedMaterial,
  });

  const filteredFiles = useMemo(() => {
    if (!notebook) {
      return [];
    }

    if (normalizedSearchQuery) {
      return notebook.files.filter((file) => fileMatchesSearch(file, normalizedSearchQuery));
    }

    return notebook.files;
  }, [notebook, normalizedSearchQuery]);

  const filteredNotebooks = useMemo(() => {
    if (!normalizedSearchQuery) {
      return allNotebooks;
    }

    return allNotebooks.filter((entry) =>
      notebookMatchesSearch(entry, normalizedSearchQuery) || countMatchingFiles(entry, normalizedSearchQuery) > 0,
    );
  }, [allNotebooks, normalizedSearchQuery]);

  const totalFileMatchCount = isSearchActive
    ? allNotebooks.reduce((total, entry) => total + countMatchingFiles(entry, normalizedSearchQuery), 0)
    : 0;

  const summaryStatus = activePreview?.summaryStatus || selectedMaterial?.summaryStatus || 'idle';
  const summaryError = activePreview?.summaryError || selectedMaterial?.summaryError;
  const summaryText = activePreview?.summary || selectedMaterial?.summary;
  const summaryDisplayText = isVideoIngestionError
    ? ingestionError || 'Video ingestion failed. Delete and reupload this file to try again.'
    : summaryStatus === 'in-progress'
      ? summaryText || 'Generating description...'
      : summaryStatus === 'error'
        ? summaryError || 'Description generation failed.'
        : summaryText || 'No generated description is available for this file.';
  const videoIngestionStatus = videoIngestionProgress >= 86
    ? 'Finalizing transcript and search index...'
    : videoIngestionProgress >= 62
      ? 'Indexing transcript for grounded search...'
      : videoIngestionProgress >= 34
        ? 'Extracting timestamped transcript...'
        : 'Preparing video for transcript extraction...';
  useEffect(() => {
    setSelectedMaterial(null);
    previewActions.setPreviewError('');
    uploadActions.setUploadError('');
    fileChatActions.setFileChatInput('');
    linkActions.setPendingLink(null);
    savedReplyActions.resetSavedReplies();
    setNotebookPanelTab('chat');
  }, [notebook?.id]);

  useEffect(() => {
    setFileDetailTab('chat');
    setSummaryRetryError('');
  }, [selectedMaterial?.id]);

  useEffect(() => {
    if (!isVideoIngestionProcessing || !selectedMaterial) {
      setVideoIngestionProgress(0);
      return;
    }

    setVideoIngestionProgress((currentProgress) => Math.max(currentProgress, 8));
    const startedAt = Date.now();
    const intervalId = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const nextProgress = Math.min(94, 8 + Math.floor((elapsed / 90000) * 86));
      setVideoIngestionProgress((currentProgress) => Math.max(currentProgress, nextProgress));
    }, 300);

    return () => window.clearInterval(intervalId);
  }, [isVideoIngestionProcessing, selectedMaterial?.id]);

  useEffect(() => {
    if (!selectedMaterial || filteredFiles.some((file) => file.id === selectedMaterial.id)) {
      return;
    }

    setSelectedMaterial(null);
  }, [filteredFiles, selectedMaterial]);

  const materialActions = useNotebookMaterialActions({
    fileChatActions,
    isDeleting,
    isDeletingNotebook,
    isRenaming,
    notebook,
    onDeleteFile,
    onDeleteNotebook,
    onRenameFile,
    onRetryFileSummary,
    pendingRenameFile,
    renameFileName,
    retryingSummaryFileId,
    selectedMaterial,
    setIsDeleteNotebookModalOpen,
    setIsDeleting,
    setIsDeletingNotebook,
    setIsRenaming,
    setPendingDeleteFile,
    setPendingRenameFile,
    setPreviewCache: previewActions.setPreviewCache,
    setPreviewError: previewActions.setPreviewError,
    setRenameError,
    setRenameFileName,
    setRetryingSummaryFileId,
    setSelectedMaterial,
    setSummaryRetryError,
  });

  if (!notebook) {
    return (
      <AllNotebooksView
        allNotebooks={allNotebooks}
        filteredNotebooks={filteredNotebooks}
        isSearchActive={isSearchActive}
        normalizedSearchQuery={normalizedSearchQuery}
        onCreateNotebookRequested={onCreateNotebookRequested}
        onDeleteNotebook={onDeleteNotebook}
        onEditNotebook={onEditNotebook}
        onSelectNotebook={onSelectNotebook}
        searchQuery={searchQuery}
        totalFileMatchCount={totalFileMatchCount}
      />
    );
  }

  return (
    <div className="space-y-6 text-left relative z-10" id={`notebook-workspace-${notebook.id}`}>
      <NotebookHeader
        colorTone={colorTone}
        notebook={notebook}
        onBackToDashboard={onBackToDashboard}
        onDeleteNotebookClick={() => setIsDeleteNotebookModalOpen(true)}
        onEditNotebook={onEditNotebook}
        onSelectNotebook={onSelectNotebook}
      />

      {(uploadState.uploadError || previewState.previewError) && (
        <div className="rounded-2xl border border-cta/20 bg-cta-subtle px-4 py-3 text-sm font-semibold text-cta">
          {uploadState.uploadError || previewState.previewError}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <MaterialsDirectory
          colorTone={colorTone}
          fileInputRef={fileInputRef}
          filteredFiles={filteredFiles}
          handleOpenRename={materialActions.handleOpenRename}
          handleUpload={uploadActions.handleUpload}
          hasUploadFailure={uploadState.hasUploadFailure}
          isDeleting={isDeleting}
          isPendingLinkActive={linkState.isPendingLinkActive}
          isSearchActive={isSearchActive}
          isUploadActive={uploadState.isUploadActive}
          isWebLinkActive={linkState.isWebLinkActive}
          isYoutubeLinkActive={linkState.isYoutubeLinkActive}
          onAddLink={onAddLink}
          onAddYoutubeLink={onAddYoutubeLink}
          onRenameFile={onRenameFile}
          pendingLink={linkState.pendingLink}
          pendingLinkStatusLabel={linkState.pendingLinkStatusLabel}
          searchQuery={searchQuery}
          setIsAddLinkModalOpen={linkActions.setIsAddLinkModalOpen}
          setIsAddYoutubeLinkModalOpen={linkActions.setIsAddYoutubeLinkModalOpen}
          setPendingDeleteFile={setPendingDeleteFile}
          setSelectedMaterial={setSelectedMaterial}
          shouldShowUploadQueue={uploadState.shouldShowUploadQueue}
          uploadPhase={uploadState.uploadPhase}
          uploadProgress={uploadState.uploadProgress}
          uploadQueue={uploadState.uploadQueue}
          uploadStatusLabel={uploadState.uploadStatusLabel}
          uploadSummaryLabel={uploadState.uploadSummaryLabel}
        />

        <NotebookStudyPanel
          fileInputRef={fileInputRef}
          notebook={notebook}
          notebookPanelTab={notebookPanelTab}
          onAddLink={onAddLink}
          onClearSavedChatReply={() => void savedReplyActions.handleClearSavedChatReply()}
          onSaveReply={savedReplyActions.handleSaveChatReply}
          onUploadFile={onUploadFile}
          savedChatReplies={savedReplyState.savedChatReplies}
          savedChatReplyClearing={savedReplyState.savedChatReplyClearing}
          savedChatReplyError={savedReplyState.savedChatReplyError}
          savedChatReplyKeys={savedReplyState.savedChatReplyKeys}
          savedChatReplyLoading={savedReplyState.savedChatReplyLoading}
          savingReplyKey={savedReplyState.savingReplyKey}
          setIsAddLinkModalOpen={linkActions.setIsAddLinkModalOpen}
          setNotebookPanelTab={setNotebookPanelTab}
        />
      </div>

      {selectedMaterial ? (
        <FilePreviewDrawer
          activeFileChatMessages={fileChatState.activeFileChatMessages}
          activePreview={activePreview}
          colorTone={colorTone}
          fileChatInput={fileChatState.fileChatInput}
          fileChatScrollRef={fileChatScrollRef}
          fileDetailTab={fileDetailTab}
          fileNoteApi={fileNoteApi}
          handleFileChatSubmit={fileChatActions.handleFileChatSubmit}
          handleOpenRename={materialActions.handleOpenRename}
          handleRetrySummary={materialActions.handleRetrySummary}
          ingestionError={ingestionError}
          isDeleting={isDeleting}
          isFileChatTyping={fileChatState.isFileChatTyping}
          isImagePreview={Boolean(isImagePreview)}
          isRetryingSummary={materialActions.isRetryingSummary}
          isSummaryOpen={isSummaryOpen}
          isVideoIngestionError={Boolean(isVideoIngestionError)}
          isVideoIngestionUnavailable={Boolean(isVideoIngestionUnavailable)}
          latestSaveableFileReply={fileChatState.latestSaveableFileReply}
          notebook={notebook}
          onRenameFile={onRenameFile}
          onRetryFileSummary={onRetryFileSummary}
          onSaveChatReply={savedReplyActions.handleSaveChatReply}
          previewError={previewState.previewError}
          previewLoading={previewState.previewLoading}
          savedChatReplyKeys={savedReplyState.savedChatReplyKeys}
          savingReplyKey={savedReplyState.savingReplyKey}
          selectedMaterial={selectedMaterial}
          selectedViewerUrl={selectedViewerUrl}
          setFileChatInput={fileChatActions.setFileChatInput}
          setFileDetailTab={setFileDetailTab}
          setIsSummaryOpen={setIsSummaryOpen}
          setPendingDeleteFile={setPendingDeleteFile}
          setSelectedMaterial={setSelectedMaterial}
          summaryDisplayText={summaryDisplayText}
          summaryRetryError={summaryRetryError}
          summaryStatus={summaryStatus}
          videoIngestionProgress={videoIngestionProgress}
          videoIngestionStatus={videoIngestionStatus}
        />
      ) : null}

      {pendingDeleteFile ? (
        <DeleteMaterialModal
          isDeleting={isDeleting}
          onClose={() => setPendingDeleteFile(null)}
          onDelete={(file) => void materialActions.handleDelete(file)}
          pendingDeleteFile={pendingDeleteFile}
        />
      ) : null}

      {pendingRenameFile ? (
        <RenameMaterialModal
          isRenaming={isRenaming}
          onClose={() => setPendingRenameFile(null)}
          onRename={() => void materialActions.handleRename()}
          renameError={renameError}
          renameFileName={renameFileName}
          setRenameError={setRenameError}
          setRenameFileName={setRenameFileName}
        />
      ) : null}

      {isDeleteNotebookModalOpen ? (
        <DeleteNotebookModal
          isDeletingNotebook={isDeletingNotebook}
          notebook={notebook}
          onClose={() => setIsDeleteNotebookModalOpen(false)}
          onDelete={() => void materialActions.handleDeleteCurrentNotebook()}
        />
      ) : null}

      {savedReplyState.isSaveToastVisible ? (
        <SavedToast onDismiss={savedReplyActions.dismissSaveToast} />
      ) : null}

      {linkState.isAddLinkModalOpen ? (
        <AddLinkModal
          notebookName={notebook.name}
          onClose={() => linkActions.setIsAddLinkModalOpen(false)}
          onSubmit={linkActions.handleAddLink}
        />
      ) : null}
      {linkState.isAddYoutubeLinkModalOpen ? (
        <AddYoutubeLinkModal
          notebookName={notebook.name}
          onClose={() => linkActions.setIsAddYoutubeLinkModalOpen(false)}
          onSubmit={linkActions.handleAddYoutubeLink}
        />
      ) : null}
    </div>
  );
}
