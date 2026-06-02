vi.mock('@/lib/prisma', () => ({
  prisma: {},
}));

import { buildStudyStreak, getMalaysiaLocalDate, getMalaysianTier } from './streak';

describe('study streak calculations', () => {
  it('uses Malaysia local dates', () => {
    expect(getMalaysiaLocalDate(new Date('2026-06-01T15:59:59.000Z'))).toBe('2026-06-01');
    expect(getMalaysiaLocalDate(new Date('2026-06-01T16:00:00.000Z'))).toBe('2026-06-02');
  });

  it('calculates current and best streaks ending today', () => {
    const streak = buildStudyStreak([
      { localDate: '2026-05-28' },
      { localDate: '2026-05-29' },
      { localDate: '2026-05-31' },
      { localDate: '2026-06-01' },
      { localDate: '2026-06-02' },
    ], '2026-06-02');

    expect(streak.currentStreak).toBe(3);
    expect(streak.bestStreak).toBe(3);
    expect(streak.lastActive).toBe('2026-06-02');
  });

  it('resets the current streak when today is inactive but preserves the best streak', () => {
    const streak = buildStudyStreak([
      { localDate: '2026-05-28' },
      { localDate: '2026-05-29' },
    ], '2026-06-02');

    expect(streak.currentStreak).toBe(0);
    expect(streak.bestStreak).toBe(2);
  });

  it('returns Monday-Sunday progress for the current Malaysia week', () => {
    const streak = buildStudyStreak([
      { localDate: '2026-06-01' },
      { localDate: '2026-06-03' },
    ], '2026-06-04');

    expect(streak.weeklyProgress).toEqual([
      { day: 'Mon', active: true },
      { day: 'Tue', active: false },
      { day: 'Wed', active: true },
      { day: 'Thu', active: false },
      { day: 'Fri', active: false },
      { day: 'Sat', active: false },
      { day: 'Sun', active: false },
    ]);
  });

  it('maps Malaysian tier thresholds', () => {
    expect(getMalaysianTier(0)).toBe('Faithful Student');
    expect(getMalaysianTier(7)).toBe('Kopi Beng Devotee');
    expect(getMalaysianTier(14)).toBe("Dean's Runner");
    expect(getMalaysianTier(30)).toBe('Royal Award Winner');
  });
});
