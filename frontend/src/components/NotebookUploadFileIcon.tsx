import React from 'react';
import { BookOpen, FileText, Image, MonitorPlay, Volume2 } from 'lucide-react';
import type { SupportedNotebookExtension } from '../lib/notebookUpload';

interface NotebookUploadFileIconProps {
  extension: SupportedNotebookExtension;
  className?: string;
}

const imageExtensions = new Set<SupportedNotebookExtension>([
  'bmp',
  'gif',
  'jpeg',
  'jpg',
  'png',
  'tif',
  'tiff',
  'webp',
]);

const audioExtensions = new Set<SupportedNotebookExtension>([
  'aac',
  'flac',
  'm4a',
  'mp3',
  'ogg',
  'wav',
]);

const videoExtensions = new Set<SupportedNotebookExtension>([
  'm4v',
  'mov',
  'mp4',
  'webm',
]);

export function NotebookUploadFileIcon({
  extension,
  className = 'h-3.5 w-3.5 shrink-0',
}: NotebookUploadFileIconProps) {
  if (extension === 'pdf' || extension === 'txt') {
    return <FileText className={`${className} ${extension === 'pdf' ? 'text-error' : 'text-success'}`} />;
  }

  if (extension === 'docx') {
    return <BookOpen className={`${className} text-accent-hover`} />;
  }

  if (extension === 'pptx' || videoExtensions.has(extension)) {
    return <MonitorPlay className={`${className} text-cta`} />;
  }

  if (audioExtensions.has(extension)) {
    return <Volume2 className={`${className} text-accent-hover`} />;
  }

  if (imageExtensions.has(extension)) {
    return <Image className={`${className} text-success`} />;
  }

  return <FileText className={`${className} text-text-muted`} />;
}
