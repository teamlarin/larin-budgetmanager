export interface MarginMetric {
  value: number;
  labor: number;
  external: number;
}

export function calculateProfit(metric: MarginMetric) {
  const totalCost = metric.labor + metric.external;
  const profit = metric.value - totalCost;
  return {
    totalCost,
    profit,
    margin: metric.value > 0 ? profit / metric.value * 100 : null,
  };
}

export function normalizeMonthlyRecurring(amount: number, periodicity: 'mensile' | 'trimestrale' | 'annuale') {
  if (periodicity === 'trimestrale') return amount / 3;
  if (periodicity === 'annuale') return amount / 12;
  return amount;
}

export function sumTargetToMonth(targets: Array<{ month: number; amount: number }>, throughMonth: number) {
  return targets.reduce((sum, target) => target.month <= throughMonth ? sum + Number(target.amount) : sum, 0);
}