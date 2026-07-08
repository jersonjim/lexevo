// computeStreak uses new Date() internally — we freeze time so tests are deterministic
jest.mock('../../supabase', () => ({ supabase: {} }));

import { computeStreak } from '../../services/leitner';

const TODAY = '2026-07-08';
const YESTERDAY = '2026-07-07';
const TWO_DAYS_AGO = '2026-07-06';
const THREE_DAYS_AGO = '2026-07-05';

function entry(date: string) {
  return { moved_at: `${date}T12:00:00.000Z` };
}

beforeAll(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-07-08T15:00:00.000Z'));
});

afterAll(() => {
  jest.useRealTimers();
});

describe('computeStreak', () => {
  describe('no data', () => {
    it('returns 0 and studiedToday=false when data is empty', () => {
      expect(computeStreak([], null)).toEqual({ streak: 0, studiedToday: false });
    });
  });

  describe('studiedToday', () => {
    it('is true when there is an entry for today', () => {
      const { studiedToday } = computeStreak([entry(TODAY)], null);
      expect(studiedToday).toBe(true);
    });

    it('is false when the most recent entry is yesterday', () => {
      const { studiedToday } = computeStreak([entry(YESTERDAY)], null);
      expect(studiedToday).toBe(false);
    });

    it('is false when the most recent entry is older than yesterday', () => {
      const { studiedToday } = computeStreak([entry(TWO_DAYS_AGO)], null);
      expect(studiedToday).toBe(false);
    });
  });

  describe('streak count', () => {
    it('returns 1 for a single entry today', () => {
      expect(computeStreak([entry(TODAY)], null).streak).toBe(1);
    });

    it('returns 1 for a single entry yesterday (streak not broken yet)', () => {
      expect(computeStreak([entry(YESTERDAY)], null).streak).toBe(1);
    });

    it('returns 0 when the last entry is older than yesterday', () => {
      expect(computeStreak([entry(TWO_DAYS_AGO)], null).streak).toBe(0);
    });

    it('counts consecutive days including today', () => {
      const data = [entry(TODAY), entry(YESTERDAY), entry(TWO_DAYS_AGO)];
      expect(computeStreak(data, null).streak).toBe(3);
    });

    it('counts consecutive days ending yesterday', () => {
      const data = [entry(YESTERDAY), entry(TWO_DAYS_AGO), entry(THREE_DAYS_AGO)];
      expect(computeStreak(data, null).streak).toBe(3);
    });

    it('stops at a gap in consecutive days', () => {
      // today + two_days_ago — yesterday is missing, so streak = 1
      const data = [entry(TODAY), entry(TWO_DAYS_AGO), entry(THREE_DAYS_AGO)];
      expect(computeStreak(data, null).streak).toBe(1);
    });

    it('deduplicates multiple entries on the same day', () => {
      const data = [
        { moved_at: `${TODAY}T09:00:00.000Z` },
        { moved_at: `${TODAY}T14:00:00.000Z` },
        { moved_at: `${TODAY}T20:00:00.000Z` },
        entry(YESTERDAY),
      ];
      expect(computeStreak(data, null).streak).toBe(2);
    });
  });

  describe('startDate filter', () => {
    it('ignores entries before startDate', () => {
      // Long consecutive history, but startDate is today — streak should be 1
      const data = [entry(TODAY), entry(YESTERDAY), entry(TWO_DAYS_AGO)];
      expect(computeStreak(data, TODAY).streak).toBe(1);
    });

    it('includes entries on the startDate itself', () => {
      const data = [entry(TODAY), entry(YESTERDAY)];
      expect(computeStreak(data, YESTERDAY).streak).toBe(2);
    });

    it('returns 0 when all entries are before startDate', () => {
      const data = [entry(YESTERDAY), entry(TWO_DAYS_AGO)];
      expect(computeStreak(data, TODAY).streak).toBe(0);
    });

    it('null startDate includes all entries', () => {
      const data = [entry(TODAY), entry(YESTERDAY), entry(TWO_DAYS_AGO), entry(THREE_DAYS_AGO)];
      expect(computeStreak(data, null).streak).toBe(4);
    });
  });
});
