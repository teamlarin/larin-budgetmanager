// Membership di progetto: NON confondere con il ruolo globale `member`.
// Un utente fa parte del team di progetto se è project leader oppure è in project_members.

export const PROJECT_WIDE_ROLES = ['admin', 'team_leader', 'coordinator', 'account', 'finance'] as const;

export interface ProjectTeam {
  leaderId?: string | null;
  memberIds?: string[] | null;
}

export function isProjectTeamMember(userId: string | null | undefined, team: ProjectTeam): boolean {
  if (!userId) return false;
  if (team.leaderId && team.leaderId === userId) return true;
  return (team.memberIds || []).includes(userId);
}

export function hasProjectWideRole(roles: string[] | null | undefined): boolean {
  return (roles || []).some((r) => (PROJECT_WIDE_ROLES as readonly string[]).includes(r));
}

export function canManageProjectTasks(
  userId: string | null | undefined,
  roles: string[] | null | undefined,
  team: ProjectTeam,
  options?: { hasExternalAccess?: boolean }
): boolean {
  if (!userId) return false;
  if (hasProjectWideRole(roles)) return true;
  if (isProjectTeamMember(userId, team)) return true;
  return !!options?.hasExternalAccess;
}
