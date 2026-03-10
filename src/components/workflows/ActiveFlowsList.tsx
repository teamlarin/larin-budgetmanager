import { User, Clock, ChevronRight, Check, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { ActiveFlow } from '@/types/workflow';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ActiveFlowsListProps {
  flows: ActiveFlow[];
  onSelectFlow: (flow: ActiveFlow) => void;
}

export const ActiveFlowsList = ({ flows, onSelectFlow }: ActiveFlowsListProps) => {
  if (flows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground/40 mb-4" />
        <h3 className="text-lg font-medium text-foreground">Nessun flusso attivo</h3>
        <p className="text-sm text-muted-foreground mt-1">Non ci sono flussi in corso al momento.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {flows.map((flow) => {
        const completedCount = flow.tasks.filter(t => t.isCompleted).length;
        const totalCount = flow.tasks.length;
        const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        const isComplete = completedCount === totalCount;

        return (
          <Card
            key={flow.id}
            className="cursor-pointer group"
            onClick={() => onSelectFlow(flow)}
          >
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {flow.templateName}
                  </h3>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                    <User className="h-3 w-3" />
                    {flow.assignedTo}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-0.5" />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{completedCount}/{totalCount} task</span>
                  {isComplete ? (
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                      <Check className="h-2.5 w-2.5 mr-1" /> Completato
                    </Badge>
                  ) : (
                    <span className="font-medium text-foreground">{progressPercent}%</span>
                  )}
                </div>
                <Progress value={progressPercent} className="h-1.5" />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-3">
                <Clock className="h-3 w-3" />
                {format(new Date(flow.createdAt), 'd MMM yyyy', { locale: it })}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
