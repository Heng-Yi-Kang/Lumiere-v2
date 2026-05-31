import { buildVideoRagSegments } from './video-processing';

describe('buildVideoRagSegments', () => {
  it('combines coarse transcript slices and frame descriptions into timestamped RAG chunks', () => {
    const segments = buildVideoRagSegments({
      durationSeconds: 61,
      fileName: 'lecture.mp4',
      frameDescriptions: [
        {
          description: 'A slide titled Sorting Algorithms with a merge sort diagram.',
          timestamp: 5,
        },
        {
          description: 'The lecturer points at pseudocode for partitioning.',
          timestamp: 35,
        },
      ],
      segmentSeconds: 30,
      transcript: 'Sorting starts with comparison based methods then moves into partitioning and merge strategies for arrays.',
    });

    expect(segments).toHaveLength(3);
    expect(segments[0].content).toContain('Timestamp: 00:00 - 00:30');
    expect(segments[0].content).toContain('Sorting Algorithms');
    expect(segments[0].metadata.videoTimestampStart).toBe(0);
    expect(segments[1].content).toContain('Timestamp: 00:30 - 01:00');
    expect(segments[1].content).toContain('partitioning');
    expect(segments[2].content).toContain('Timestamp: 01:00 - 01:01');
    expect(segments[2].metadata.fileType).toBe('video');
  });
});
