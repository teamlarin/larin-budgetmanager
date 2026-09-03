import { describe, it, expect } from 'vitest';
import {
  buildCapacityBreakdown,
  grossCapacityHours,
  isAbsenceProjectName,
} from '@/lib/capacity';

describe('capacità di lavoro', () => {
  it('riconosce il progetto assenze', () => {
    expect(isAbsenceProjectName('Larin OFF 2026 - Ferie, permessi, malattia, banca ore')).toBe(true);
    expect(isAbsenceProjectName('larin off 2025')).toBe(true);
    expect(isAbsenceProjectName('Funivie Marmolada')).toBe(false);
    expect(isAbsenceProjectName(null)).toBe(false);
  });

  it('converte le ore di contratto sulla settimana lavorativa', () => {
    expect(grossCapacityHours(8, 'daily', 5)).toBe(40);
    expect(grossCapacityHours(40, 'weekly', 5)).toBe(40);
    expect(grossCapacityHours(176, 'monthly', 5)).toBe(40);
    expect(grossCapacityHours(0, 'weekly', 5)).toBe(0);
  });

  it('senza assenze la capacità netta resta quella contrattuale', () => {
    const b = buildCapacityBreakdown({
      capacityGross: 40,
      absenceHours: 0,
      plannedHours: 30,
      confirmedHours: 20,
    });
    expect(b.capacityNet).toBe(40);
    expect(b.freeHours).toBe(10);
    expect(b.plannedPct).toBe(75);
    expect(b.confirmedPct).toBe(50);
  });

  it('tre giorni di ferie non lasciano 24 ore libere fantasma', () => {
    const b = buildCapacityBreakdown({
      capacityGross: 40,
      absenceHours: 24,
      plannedHours: 16,
      confirmedHours: 16,
    });
    expect(b.capacityNet).toBe(16);
    expect(b.freeHours).toBe(0);
    expect(b.plannedPct).toBe(100);
  });

  it('non produce valori negativi né divisioni per zero', () => {
    const b = buildCapacityBreakdown({
      capacityGross: 8,
      absenceHours: 20,
      plannedHours: 0,
      confirmedHours: 4,
    });
    expect(b.capacityNet).toBe(0);
    expect(b.freeHours).toBe(0);
    expect(b.plannedPct).toBe(0);
    expect(b.confirmedPct).toBe(0);
  });

  it('pianificato e confermato sono indipendenti', () => {
    const b = buildCapacityBreakdown({
      capacityGross: 40,
      absenceHours: 0,
      plannedHours: 8,
      confirmedHours: 36,
    });
    expect(b.plannedPct).toBe(20);
    expect(b.confirmedPct).toBe(90);
  });
});
