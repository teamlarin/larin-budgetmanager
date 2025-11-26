import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface ProjectActivitiesManagerProps {
  projectId: string;
  briefLink?: string | null;
  objective?: string | null;
}

interface BudgetItem {
  id: string;
  activity_name: string;
  category: string;
  hourly_rate: number;
  hours_worked: number;
  total_cost: number;
  assignee_id: string | null;
  assignee_name: string | null;
}

const categoryColors: Record<string, string> = {
  Management: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  Design: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  Dev: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  Content: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  Support: "bg-gray-500/10 text-gray-700 dark:text-gray-400 border-gray-500/20",
};

export const ProjectActivitiesManager = ({ projectId, briefLink, objective }: ProjectActivitiesManagerProps) => {
  const { data: activities = [], isLoading } = useQuery<BudgetItem[]>({
    queryKey: ['budget-items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_items')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_product', false)
        .order('display_order', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-muted rounded"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Brief and Objective Section */}
      <Card>
        <CardHeader>
          <CardTitle>Informazioni Progetto</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Link Brief</p>
            {briefLink ? (
              <Button
                variant="outline"
                className="w-full justify-start"
                asChild
              >
                <a href={briefLink} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Apri Brief
                </a>
              </Button>
            ) : (
              <p className="text-muted-foreground italic">Nessun brief disponibile</p>
            )}
          </div>
          <div>
            <p className="text-sm text-muted-foreground mb-2">Obiettivo</p>
            <p className="text-foreground whitespace-pre-wrap">
              {objective || 'Nessun obiettivo definito'}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Activities Section */}
      <Card>
        <CardHeader>
          <CardTitle>Attività Previste</CardTitle>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nessuna attività presente nel budget
            </p>
          ) : (
            <div className="space-y-4">
              {activities.map((activity) => {
                const categoryColor = categoryColors[activity.category] || categoryColors.Management;
                
                return (
                  <div
                    key={activity.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {activity.activity_name}
                        </span>
                        <Badge className={categoryColor}>
                          {activity.category}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {activity.hours_worked}h (€{activity.total_cost.toLocaleString('it-IT', { minimumFractionDigits: 2 })})
                      </div>
                      {activity.assignee_name && (
                        <div className="text-sm text-muted-foreground">
                          Figura prevista: <span className="font-medium text-foreground">{activity.assignee_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};