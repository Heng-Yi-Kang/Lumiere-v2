import {
  normalizeYoutubeVideoUrl,
  probeYoutubeVideoMetadata,
  youtubeDownloadFormatForTests,
} from './youtube-video-ingestion';

describe('YouTube video ingestion helpers', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ?t=42', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'],
  ])('canonicalizes %s', (input, canonicalUrl) => {
    expect(normalizeYoutubeVideoUrl(input)).toEqual({
      canonicalUrl,
      videoId: 'dQw4w9WgXcQ',
    });
  });

  it.each([
    'https://example.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/playlist?list=PL123',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123',
    'https://www.youtube.com/channel/UC123456789',
  ])('rejects unsupported URL %s', (input) => {
    expect(() => normalizeYoutubeVideoUrl(input)).toThrow();
  });

  it('extracts metadata through yt-dlp', async () => {
    const runCommand = vi.fn().mockResolvedValue({
      stderr: '',
      stdout: JSON.stringify({
        filesize: 12_345,
        id: 'dQw4w9WgXcQ',
        title: 'Lecture video',
      }),
    });

    await expect(probeYoutubeVideoMetadata('https://youtu.be/dQw4w9WgXcQ', { runCommand })).resolves.toEqual({
      canonicalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      estimatedSizeBytes: 12_345,
      title: 'Lecture video',
      videoId: 'dQw4w9WgXcQ',
    });
    expect(runCommand).toHaveBeenCalledWith(
      'yt-dlp',
      expect.arrayContaining(['--dump-single-json', '--no-playlist', '--skip-download']),
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });

  it('uses a <=720p format selector for downloads', () => {
    expect(youtubeDownloadFormatForTests).toContain('height<=720');
    expect(youtubeDownloadFormatForTests).toContain('ext=mp4');
  });

  it('rejects metadata larger than the upload limit', async () => {
    const runCommand = vi.fn().mockResolvedValue({
      stderr: '',
      stdout: JSON.stringify({
        filesize: 101 * 1024 * 1024,
        id: 'dQw4w9WgXcQ',
        title: 'Large lecture video',
      }),
    });

    await expect(probeYoutubeVideoMetadata('https://youtu.be/dQw4w9WgXcQ', { runCommand }))
      .rejects
      .toThrow('100 MB upload limit');
  });
});
