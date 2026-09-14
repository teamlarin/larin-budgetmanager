import { describe, it, expect } from 'vitest';
import { distributeMinutesAcrossDays, buildBusyMap } from '@/components/calendar/planningUtils';

const week = ['2026-09-14', '2026-09-15', '2026-09-16', '2026-09-17', '2026-09-18'].map(
  d => new Date(`${d}T00:00:00`)
);

const base = {
  workDayStart: '08:00',
  workDayEnd: '18:00',
  days: week,
};

describe('distribuzione ore nel planner', () => {
  it('20 ore su 5 giorni con contratto 8h danno 4h al giorno', () => {
    const { slots, unallocatedMinutes } = distributeMinutesAcrossDays({
      ...base,
      totalMinutes: 20 * 60,
      busyByDate: new Map(),
      dailyCapMinutes: 8 * 60,
    });
    expect(unallocatedMinutes).toBe(0);
    expect(slots).toHaveLength(5);
    slots.forEach(s => {
      expect(s.scheduled_start_time).toBe('08:00');
      expect(s.scheduled_end_time).toBe('12:00');
    });
  });

  it('rispetta il tetto giornaliero quando la giornata è già occupata', () => {
    const busy = buildBusyMap([
      { scheduled_date: '2026-09-14', scheduled_start_time: '08:00', scheduled_end_time: '14:00' },
    ]);
    const { slots } = distributeMinutesAcrossDays({
      ...base,
      totalMinutes: 10 * 60,
      busyByDate: busy,
      dailyCapMinutes: 8 * 60,
    });
    const monday = slots.find(s => s.scheduled_date === '2026-09-14');
    expect(monday?.scheduled_start_time).toBe('14:00');
    expect(monday?.scheduled_end_time).toBe('16:00');
  });

  it('segnala le ore che superano la capacità contrattuale della settimana', () => {
    const { slots, unallocatedMinutes } = distributeMinutesAcrossDays({
      ...base,
      totalMinutes: 50 * 60,
      busyByDate: new Map(),
      dailyCapMinutes: 8 * 60,
    });
    expect(slots).toHaveLength(5);
    slots.forEach(s => expect(s.scheduled_end_time).toBe('16:00'));
    expect(unallocatedMinutes).toBe(10 * 60);
  });

  it('senza contratto resta il limite dell\'orario di fine giornata', () => {
    const { slots } = distributeMinutesAcrossDays({
      ...base,
      totalMinutes: 20 * 60,
      busyByDate: new Map(),
    });
    expect(slots).toHaveLength(5);
    slots.forEach(s => expect(s.scheduled_end_time).toBe('12:00'));
  });
});
