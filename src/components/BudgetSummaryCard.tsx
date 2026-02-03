import { BudgetSummary } from '@/types/budget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Euro, Clock, TrendingUp } from 'lucide-react';
import { getCategoryChartColor } from '@/lib/categoryColors';

interface BudgetSummaryCardProps {
  summary: BudgetSummary;
}

export const BudgetSummaryCard = ({ summary }: BudgetSummaryCardProps) => {
  const activeCategories = Object.entries(summary.categoryBreakdown)
    .filter(([_, data]) => data.cost > 0)
    .sort(([_, a], [__, b]) => b.cost - a.cost);

  const activitiesTotal = Object.values(summary.categoryBreakdown).reduce((sum, data) => sum + data.cost, 0);
  const averageRate = summary.totalHours > 0 ? Math.round(activitiesTotal / summary.totalHours) : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-3">
        {/* Total Cost */}
        <Card className="bg-gradient-primary text-white shadow-medium">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm font-medium">Costo totale</p>
              <p className="text-3xl font-bold">
                {summary.totalCost.toLocaleString()} €
              </p>
            </div>
              <Euro className="w-8 h-8 text-white/60" />
            </div>
          </CardContent>
        </Card>

        {/* Total Hours */}
        <Card className="bg-gradient-card shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Ore totali</p>
                <p className="text-3xl font-bold text-foreground">
                  {summary.totalHours}
                </p>
              </div>
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        {/* Average Rate */}
        <Card className="bg-gradient-card shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Tariffa Media</p>
                <p className="text-3xl font-bold text-foreground">
                  {averageRate} €
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      {activeCategories.length > 0 && (
        <Card className="md:col-span-3 bg-gradient-card shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg">Ripartizione per Categoria</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Barra di ripartizione visuale */}
            <div className="flex h-8 rounded-lg overflow-hidden">
            {activeCategories.map(([category, data]) => {
                const percentage = (data.cost / activitiesTotal) * 100;
                const colors = getCategoryChartColor(category);
                return (
                  <div
                    key={category}
                    className={`${colors.bg} flex items-center justify-center text-white text-xs font-medium transition-all hover:opacity-80`}
                    style={{ width: `${percentage}%` }}
                    title={`${category}: ${data.cost.toLocaleString()} € (${percentage.toFixed(1)}%)`}
                  >
                    {percentage > 5 && `${percentage.toFixed(0)}%`}
                  </div>
                );
              })}
            </div>
            
            {/* Legenda con dettagli */}
            <div className="flex flex-wrap gap-4">
              {activeCategories.map(([category, data]) => {
                const colors = getCategoryChartColor(category);
                return (
                  <div key={category} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${colors.bg}`} />
                    <span className="text-sm font-medium text-foreground">
                      {category}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {data.cost.toLocaleString()} € ({data.hours} h)
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};