export interface Assignee {
  id: string;
  name: string;
  role: string;
  hourlyRate: number;
}

export interface ProjectType {
  id: string;
  name: string;
  activities: PredefinedActivity[];
}

export interface PredefinedActivity {
  id: string;
  name: string;
  category: Category;
  estimatedHours: number;
  description?: string;
}

export interface BudgetItem {
  id: string;
  category: string;
  activityName: string;
  assigneeId: string;
  assigneeName: string;
  hourlyRate: number;
  hoursWorked: number;
  totalCost: number;
  isCustomActivity?: boolean;
  displayOrder?: number;
}

export type Category = 'Management' | 'Design' | 'Dev' | 'Content' | 'Support';

export interface BudgetSummary {
  totalCost: number;
  totalHours: number;
  categoryBreakdown: Record<string, {
    cost: number;
    hours: number;
  }>;
}