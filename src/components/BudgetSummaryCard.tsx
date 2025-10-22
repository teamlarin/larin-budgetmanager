import { BudgetSummary } from '@/types/budget';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Euro, Clock, TrendingUp } from 'lucide-react';

interface BudgetSummaryCardProps {
  summary: BudgetSummary;
}

const categoryColors = {
  Management: 'bg-management',
  Design: 'bg-design',
  Dev: 'bg-dev',
  Content: 'bg-content',
  Support: 'bg-support',
};

export const BudgetSummaryCard = ({ summary }: BudgetSummaryCardProps) => {
  const activeCategories = Object.entries(summary.categoryBreakdown)
    .filter(([_, data]) => data.cost > 0)
    .sort(([_, a], [__, b]) => b.cost - a.cost);

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {/* Total Cost */}
      <Card className="bg-gradient-primary text-white shadow-medium">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
          <div>
            <p className="text-white/80 text-sm font-medium">Costo Totale</p>
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
              <p className="text-muted-foreground text-sm font-medium">Ore Totali</p>
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
              {summary.totalHours > 0 ? Math.round(summary.totalCost / summary.totalHours) : 0} €
            </p>
          </div>
            <TrendingUp className="w-8 h-8 text-muted-foreground" />
          </div>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      {activeCategories.length > 0 && (
        <Card className="md:col-span-3 bg-gradient-card shadow-soft">
          <CardHeader>
            <CardTitle className="text-lg">Ripartizione per Categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeCategories.map(([category, data]) => (
                <div key={category} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${categoryColors[category as keyof typeof categoryColors]}`} />
                    <span className="font-medium text-foreground">{category}</span>
                  </div>
                <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
                  <span>{data.cost.toLocaleString()} €</span>
                  <span>{data.hours}h</span>
                </div>
                  <div className="bg-muted rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${categoryColors[category as keyof typeof categoryColors]} transition-all duration-500`}
                      style={{ width: `${(data.cost / summary.totalCost) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};