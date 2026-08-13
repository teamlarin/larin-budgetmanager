import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'fs';
import { render, cleanup, screen } from '@testing-library/react';
import {
  filterAndSortProjectTasks,
  type ProjectTask,
  type ProjectTaskPriority,
  type ProjectTaskSortKey,
  type ProjectTaskStatus,
} from '@/lib/projectTaskSort';
import { ProjectTasksCalendar, type TaskCalendarMode } from '@/components/project-tasks/ProjectTasksCalendar';

const PROJECT = 'p1';
const OTHER_PROJECT = 'p2';

const nameById = new Map<string, string>([
  ['u1', 'Anna Rossi'],
  ['u2', 'Marco Bianchi'],
]);

// Tutte le date cadono nella settimana/mese ancorati a "oggi" reale del test run
const D = (offsetDays: number): string => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

let seq = 0;
const task = (over: Partial<ProjectTask> = {}): ProjectTask => {
  seq += 1;
  return {
    id: `t${seq}`,
    project_id: PROJECT,
    title: `Task ${seq}`,
    description: null,
    assignee_id: 'u1',
    status: 'todo',
    priority: 'medium',
    due_date: D(0),
    workflow_flow_task_id: null,
    created_by: 'u1',
    completed_at: null,
    created_at: `2026-01-0${(seq % 9) + 1}T10:00:00Z`,
    updated_at: '2026-01-01T10:00:00Z',
    recurrence_rule: 'none',
    recurrence_interval: 1,
    recurrence_end_date: null,
    recurrence_parent_id: null,
    ...over,
  };
};

const tasks: ProjectTask[] = [
  task({ title: 'Alta oggi Anna', priority: 'high', status: 'todo', assignee_id: 'u1', due_date: D(0) }),
  task({ title: 'Media oggi Marco', priority: 'medium', status: 'in_progress', assignee_id: 'u2', due_date: D(0) }),
  task({ title: 'Bassa oggi non assegnata', priority: 'low', status: 'done', assignee_id: null, due_date: D(0) }),
  task({ title: 'Alta domani Marco', priority: 'high', status: 'in_progress', assignee_id: 'u2', due_date: D(1) }),
  task({ title: 'Media senza scadenza Anna', priority: 'medium', status: 'todo', assignee_id: 'u1', due_date: null }),
  task({ title: 'Ricorrente oggi Anna', priority: 'high', status: 'todo', assignee_id: 'u1', due_date: D(0), recurrence_rule: 'weekly' }),
];

const STATUSES: Array<ProjectTaskStatus | 'all'> = ['all', 'todo', 'in_progress', 'done'];
const PRIORITIES: Array<ProjectTaskPriority | 'all'> = ['all', 'high', 'medium', 'low'];
const ASSIGNEES: Array<string> = ['all', 'unassigned', 'u1', 'u2'];
const SORTS: ProjectTaskSortKey[] = ['priority', 'due_date', 'status', 'created_at'];
const MODES: TaskCalendarMode[] = ['month', 'week'];
const SEARCHES = ['', 'oggi', 'Marco'];

afterEach(() => cleanup());

const titlesInDom = (): string[] =>
  Array.from(document.querySelectorAll('button[title]'))
    .map((b) => b.querySelector('span.truncate')?.textContent || '')
    .filter(Boolean);

describe('ProjectTasksCalendar — RLS / isolamento dati', () => {
  it('non esegue query: mostra solo le task ricevute (già filtrate da RLS)', () => {
    const src = readFileSync('src/components/project-tasks/ProjectTasksCalendar.tsx', 'utf8');
    expect(src).not.toMatch(/integrations\/supabase|supabase\./);
    expect(src).not.toMatch(/SERVICE_ROLE|service_role/);
  });

  it('non introduce task di altri progetti', () => {
    const allowed = tasks.filter((t) => t.project_id === PROJECT);
    const foreign = task({ project_id: OTHER_PROJECT, title: 'Task di altro progetto' });
    render(
      <ProjectTasksCalendar tasks={allowed} mode="month" onModeChange={() => {}} nameById={nameById} />
    );
    expect(screen.queryByText(foreign.title)).toBeNull();
    expect(titlesInDom().length).toBe(allowed.length);
  });
});

describe('ProjectTasksCalendar — filtri e ordinamento su tutte le combinazioni', () => {
  it('mostra esattamente le task filtrate, nello stesso ordine della lista', () => {
    let combos = 0;
    for (const mode of MODES) {
      for (const status of STATUSES) {
        for (const priority of PRIORITIES) {
          for (const assigneeId of ASSIGNEES) {
            for (const sortKey of SORTS) {
              for (const search of SEARCHES) {
                const expected = filterAndSortProjectTasks(
                  tasks,
                  { status, priority, assigneeId },
                  sortKey,
                  search,
                  nameById
                );
                cleanup();
                render(
                  <ProjectTasksCalendar
                    tasks={expected}
                    mode={mode}
                    onModeChange={() => {}}
                    nameById={nameById}
                  />
                );
                const rendered = titlesInDom();
                // stesso insieme e nessuna task extra
                expect(new Set(rendered)).toEqual(new Set(expected.map((t) => t.title)));
                // ordinamento preservato tra le task datate (mese: tutte visibili)
                const datedExpected = expected.filter((t) => t.due_date).map((t) => t.title);
                const datedRendered = rendered.filter((t) => datedExpected.includes(t));
                const byDay = new Map<string, string[]>();
                expected.forEach((t) => {
                  if (!t.due_date) return;
                  const arr = byDay.get(t.due_date) || [];
                  arr.push(t.title);
                  byDay.set(t.due_date, arr);
                });
                // per ogni giorno l'ordine relativo deve rispettare l'ordinamento richiesto
                for (const [, dayTitles] of byDay) {
                  const positions = dayTitles.map((t) => datedRendered.indexOf(t));
                  expect(positions).toEqual([...positions].sort((a, b) => a - b));
                }
                if (expected.length === 0) {
                  expect(screen.getByText(/Nessuna task corrisponde ai filtri/)).toBeTruthy();
                }
                combos += 1;
              }
            }
          }
        }
      }
    }
    expect(combos).toBe(
      MODES.length * STATUSES.length * PRIORITIES.length * ASSIGNEES.length * SORTS.length * SEARCHES.length
    );
  });

  it('le task senza scadenza restano nella sezione dedicata e non spariscono', () => {
    const expected = filterAndSortProjectTasks(tasks, {}, 'priority');
    render(<ProjectTasksCalendar tasks={expected} mode="week" onModeChange={() => {}} nameById={nameById} />);
    expect(screen.getByText('Senza scadenza')).toBeTruthy();
    expect(screen.getByText('Media senza scadenza Anna')).toBeTruthy();
  });
});
