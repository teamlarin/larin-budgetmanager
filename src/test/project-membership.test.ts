import { describe, it, expect } from 'vitest';
import { isProjectTeamMember, hasProjectWideRole, canManageProjectTasks } from '@/lib/projectMembership';

describe('isProjectTeamMember', () => {
  it('riconosce il project leader', () => {
    expect(isProjectTeamMember('u1', { leaderId: 'u1', memberIds: [] })).toBe(true);
  });
  it('riconosce un membro del team', () => {
    expect(isProjectTeamMember('u2', { leaderId: 'u1', memberIds: ['u2', 'u3'] })).toBe(true);
  });
  it('esclude chi non fa parte del progetto', () => {
    expect(isProjectTeamMember('u9', { leaderId: 'u1', memberIds: ['u2'] })).toBe(false);
  });
  it('gestisce userId nullo e liste vuote', () => {
    expect(isProjectTeamMember(null, { leaderId: 'u1' })).toBe(false);
    expect(isProjectTeamMember('u1', {})).toBe(false);
  });
});

describe('hasProjectWideRole', () => {
  it('vero per ruoli con visibilità globale', () => {
    expect(hasProjectWideRole(['coordinator'])).toBe(true);
    expect(hasProjectWideRole(['admin', 'member'])).toBe(true);
  });
  it('falso per ruolo globale member o external', () => {
    expect(hasProjectWideRole(['member'])).toBe(false);
    expect(hasProjectWideRole(['external'])).toBe(false);
    expect(hasProjectWideRole(null)).toBe(false);
  });
});

describe('canManageProjectTasks', () => {
  const team = { leaderId: 'pl', memberIds: ['m1'] };
  it('consente al ruolo wide anche se non membro', () => {
    expect(canManageProjectTasks('x', ['admin'], team)).toBe(true);
  });
  it('consente al membro con ruolo member', () => {
    expect(canManageProjectTasks('m1', ['member'], team)).toBe(true);
  });
  it('consente al project leader', () => {
    expect(canManageProjectTasks('pl', ['member'], team)).toBe(true);
  });
  it('blocca il non membro senza ruolo wide', () => {
    expect(canManageProjectTasks('x', ['member'], team)).toBe(false);
  });
  it('consente external con accesso al progetto', () => {
    expect(canManageProjectTasks('ext', ['external'], team, { hasExternalAccess: true })).toBe(true);
    expect(canManageProjectTasks('ext', ['external'], team, { hasExternalAccess: false })).toBe(false);
  });
});
