export interface BudgetItem {
  id: string;
  category: Category;
  activityName: string;
  assignee: string;
  hourlyRate: number;
  hoursWorked: number;
  totalCost: number;
}

export type Category = 'Management' | 'Design' | 'Dev' | 'Content' | 'Support';

export interface BudgetSummary {
  totalCost: number;
  totalHours: number;
  categoryBreakdown: Record<Category, {
    cost: number;
    hours: number;
  }>;
}