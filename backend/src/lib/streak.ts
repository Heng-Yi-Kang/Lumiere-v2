import { prisma } from '@/lib/prisma';

export type MalaysianTier =
  | 'Faithful Student'
  | 'Kopi Beng Devotee'
  | "Dean's Runner"
  | 'Royal Award Winner';

const MALAYSIA_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

type StudyActivityDay = {
  localDate: string;
};

export function getMalaysiaLocalDate(now = new Date()) {
  return new Date(now.getTime() + MALAYSIA_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

function localDateToUtcMs(localDate: string) {
  return Date.parse(`${localDate}T00:00:00.000Z`);
}

function addDays(localDate: string, days: number) {
  return new Date(localDateToUtcMs(localDate) + days * DAY_MS).toISOString().slice(0, 10);
}

function getDayLabel(localDate: string) {
  return DAY_LABELS[new Date(`${localDate}T00:00:00.000Z`).getUTCDay()];
}

function getCurrentWeekDates(todayLocalDate: string) {
  const dayOfWeek = new Date(`${todayLocalDate}T00:00:00.000Z`).getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = addDays(todayLocalDate, mondayOffset);

  return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

export function getMalaysianTier(currentStreak: number): MalaysianTier {
  if (currentStreak >= 30) {
    return 'Royal Award Winner';
  }

  if (currentStreak >= 14) {
    return "Dean's Runner";
  }

  if (currentStreak >= 7) {
    return 'Kopi Beng Devotee';
  }

  return 'Faithful Student';
}

export function buildStudyStreak(activityDays: StudyActivityDay[], todayLocalDate = getMalaysiaLocalDate()) {
  const activityDateSet = new Set(activityDays.map((day) => day.localDate));
  const sortedDates = Array.from(activityDateSet).sort();
  const lastActive = sortedDates.at(-1) || '';
  let currentStreak = 0;

  if (activityDateSet.has(todayLocalDate)) {
    for (
      let cursor = todayLocalDate;
      activityDateSet.has(cursor);
      cursor = addDays(cursor, -1)
    ) {
      currentStreak += 1;
    }
  }

  let bestStreak = 0;
  let streakRun = 0;
  let previousDate = '';

  for (const localDate of sortedDates) {
    streakRun = previousDate && addDays(previousDate, 1) === localDate ? streakRun + 1 : 1;
    bestStreak = Math.max(bestStreak, streakRun);
    previousDate = localDate;
  }

  return {
    bestStreak,
    currentStreak,
    lastActive,
    malaysianTier: getMalaysianTier(currentStreak),
    weeklyProgress: getCurrentWeekDates(todayLocalDate).map((localDate) => ({
      active: activityDateSet.has(localDate),
      day: getDayLabel(localDate),
    })),
  };
}

export async function recordStudyActivity(userId: string, now = new Date()) {
  const todayLocalDate = getMalaysiaLocalDate(now);

  await prisma.studyActivityDay.upsert({
    where: {
      userId_localDate: {
        localDate: todayLocalDate,
        userId,
      },
    },
    create: {
      localDate: todayLocalDate,
      userId,
    },
    update: {},
  });

  const activityDays = await prisma.studyActivityDay.findMany({
    where: { userId },
    orderBy: { localDate: 'asc' },
    select: { localDate: true },
  });

  return buildStudyStreak(activityDays, todayLocalDate);
}
