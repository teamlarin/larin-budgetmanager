export interface Activity {
  id: string;
  activity_name: string;
  category: string;
  hours_worked: number;
  total_cost: number;
  project_id: string;
  project_name: string;
  assignee_id: string;
  confirmed_hours: number;
  planned_hours: number;
  billing_type?: string | null;
}

export interface TimeTracking {
  id: string;
  budget_item_id: string;
  user_id: string;
  scheduled_date: string | null;
  scheduled_start_time: string | null;
  scheduled_end_time: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  notes: string | null;
  is_recurring?: boolean;
  recurrence_type?: string;
  recurrence_parent_id?: string | null;
  google_event_id?: string | null;
  google_event_title?: string | null;
  confirmed?: boolean;
  activity?: Activity;
}

export interface DragCreateState {
  isCreating: boolean;
  startDate: Date | null;
  startHour: number;
  startMinutes: number;
  currentMinutes: number;
}

export const HOURS = Array.from({ length: 24 }, (_, i) => i);
export const DEFAULT_HOUR_HEIGHT = 60;
export const ZOOM_LEVELS = [60, 80, 100, 120];

// Roles that can view other users' calendars
export const CALENDAR_VIEWER_ROLES = ['admin', 'team_leader', 'coordinator', 'external'];
// Roles that can also edit other users' calendars
export const CALENDAR_EDITOR_ROLES = ['admin', 'team_leader'];

// Helper to create ISO datetime string with local timezone
export const createLocalISOString = (date: string, time: string): string => {
  const normalizedTime = time.length === 5 ? `${time}:00` : time;
  const localDate = new Date(`${date}T${normalizedTime}`);
  return localDate.toISOString();
};
