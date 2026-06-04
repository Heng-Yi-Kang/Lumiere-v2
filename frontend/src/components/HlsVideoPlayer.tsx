import { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import { buildNotebookApiUrl, fetchNotebookFileHlsStatus } from '../lib/notebooksApi';
import { HlsStatus } from '../types';

type HlsVideoPlayerProps = {
  fileId: string;
  initialHls?: HlsStatus;
  originalVideoUrl: string;
};

function getPlaybackUrl(status: HlsStatus | undefined, originalVideoUrl: string) {
  if (status?.hlsStatus === 'READY' && status.hlsMasterPlaylistUrl) {
    return buildNotebookApiUrl(status.hlsMasterPlaylistUrl);
  }

  return originalVideoUrl;
}

export default function HlsVideoPlayer({
  fileId,
  initialHls,
  originalVideoUrl,
}: HlsVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [hls, setHls] = useState<HlsStatus | undefined>(initialHls);
  const [statusError, setStatusError] = useState<string | null>(null);
  const playbackUrl = useMemo(() => getPlaybackUrl(hls, originalVideoUrl), [hls, originalVideoUrl]);
  const isHlsReady = hls?.hlsStatus === 'READY' && Boolean(hls.hlsMasterPlaylistUrl);
  const isProcessing = hls?.hlsStatus === 'PENDING' || hls?.hlsStatus === 'PROCESSING';
  const isFailed = hls?.hlsStatus === 'FAILED';

  useEffect(() => {
    setHls(initialHls);
    setStatusError(null);
  }, [fileId, initialHls]);

  useEffect(() => {
    if (!isProcessing) {
      return undefined;
    }

    let cancelled = false;
    const refreshStatus = async () => {
      try {
        const nextStatus = await fetchNotebookFileHlsStatus(fileId);
        if (!cancelled) {
          setHls(nextStatus);
          setStatusError(null);
        }
      } catch (error) {
        if (!cancelled) {
          setStatusError(error instanceof Error ? error.message : 'Unable to refresh HLS status.');
        }
      }
    };
    const intervalId = window.setInterval(refreshStatus, 10_000);
    void refreshStatus();

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [fileId, isProcessing]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return undefined;
    }

    if (!isHlsReady) {
      video.src = playbackUrl;
      return undefined;
    }

    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = playbackUrl;
      return undefined;
    }

    if (!Hls.isSupported()) {
      video.src = originalVideoUrl;
      return undefined;
    }

    const hlsPlayer = new Hls({
      xhrSetup: (xhr) => {
        xhr.withCredentials = true;
      },
    });
    hlsPlayer.loadSource(playbackUrl);
    hlsPlayer.attachMedia(video);

    return () => {
      hlsPlayer.destroy();
    };
  }, [isHlsReady, originalVideoUrl, playbackUrl]);

  return (
    <div className="space-y-3">
      <video
        ref={videoRef}
        controls
        crossOrigin="use-credentials"
        preload="metadata"
        className="max-h-[360px] w-full rounded-lg bg-black"
      >
        <a href={playbackUrl}>Download video</a>
      </video>

      {isProcessing ? (
        <div className="flex items-center gap-2 text-xs font-semibold text-text-muted">
          <LoaderCircle className="h-4 w-4 animate-spin" />
          HLS streaming is processing. Playing the original video for now.
        </div>
      ) : null}

      {isFailed ? (
        <div className="flex items-center gap-2 text-xs font-semibold text-error">
          <AlertCircle className="h-4 w-4" />
          HLS streaming failed. Playing the original video.
        </div>
      ) : null}

      {statusError ? (
        <div className="text-xs font-semibold text-text-muted">{statusError}</div>
      ) : null}
    </div>
  );
}

