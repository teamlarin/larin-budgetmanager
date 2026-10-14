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
  isProduct?: boolean;
  productId?: string;
  linkedProductId?: string | null;
  displayOrder?: number;
  sourceTemplateId?: string | null;
  /** Costo esterno: costo fisso d'acquisto + ricarico %, senza ore */
  isExternalCost?: boolean;
  externalCostBase?: number | null;
  externalCostMarkup?: number | null;
  supplierId?: string | null;
}

/** Prezzo al cliente di un costo esterno: costo × (1 + ricarico/100) */
export const externalCostPrice = (base: number, markup: number) =>
  Math.round((Number(base) || 0) * (1 + (Number(markup) || 0) / 100) * 100) / 100;

/** Totale riga: costo esterno → prezzo con ricarico, altrimenti tariffa × ore */
export const budgetItemTotal = (item: Pick<BudgetItem, 'hourlyRate' | 'hoursWorked' | 'isExternalCost' | 'externalCostBase' | 'externalCostMarkup'>) =>
  item.isExternalCost
    ? externalCostPrice(item.externalCostBase ?? 0, item.externalCostMarkup ?? 30)
    : item.hourlyRate * item.hoursWorked;

export type Category = 'Management' | 'Design' | 'Dev' | 'Content' | 'Support';

export interface BudgetSummary {
  totalCost: number;
  totalHours: number;
  discountPercentage: number;
  discountedTotal: number;
  categoryBreakdown: Record<string, {
    cost: number;
    hours: number;
  }>;
}